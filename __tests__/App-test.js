/**
 * @format
 */

import 'react-native';
import React from 'react';
// import App from '../App';

// Note: test renderer must be required after react-native.
import renderer from 'react-test-renderer';
import assert from 'assert';
import ThresholdKey from '@tkey/default';
import { generatePrivate } from '@toruslabs/eccrypto';
import ServiceProviderTorus from "@tkey/service-provider-torus";
import { MockStorageLayer } from '@tkey/storage-layer-torus';
import { createSandbox } from "sinon";

import { ecCurve, getPubKeyPoint } from "@tkey/common-types";
import PrivateKeyModule, { ED25519Format, SECP256K1Format } from "@tkey/private-keys";
import SecurityQuestionsModule from "@tkey/security-questions";
import SeedPhraseModule, { MetamaskSeedPhraseFormat } from "@tkey/seed-phrase";
import TorusServiceProvider from "@tkey/service-provider-torus";
import ShareTransferModule from "@tkey/share-transfer";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import { post } from "@toruslabs/http-helpers";
import { deepEqual, deepStrictEqual, equal, fail, notEqual, notStrictEqual, strict, strictEqual, throws } from "assert";
import BN from "bn.js";
import { keccak256 } from "web3-utils";

const PRIVATE_KEY = generatePrivate().toString("hex");
const torusSP = new ServiceProviderTorus({
  postboxKey: PRIVATE_KEY,
  customAuthArgs: {
    // this url has no effect as postbox key is passed
    // passing it just to satisfy direct auth checks.
    baseUrl: "http://localhost:3000",
  },
});
const metadataURL = "https://metadata.tor.us";
const toruStorageLayer = new MockStorageLayer({
  hostUrl: "https://metadata.tor.us",
});
const rejects = async (fn, error, msg) => {
  let f = () => {};
  try {
    await fn();
  } catch (e) {
    f = () => {
      throw e;
    };
  } finally {
    throws(f, error, msg);
  }
};
function getTempKey() {
  return generatePrivate().toString("hex");
}
export function getServiceProvider(params) {
  const { type, privKeyBN, isEmptyProvider } = params;
  const PRIVATE_KEY = privKeyBN ? privKeyBN.toString("hex") : generatePrivate().toString("hex");
  if (type === "TorusServiceProvider") {
    return new ServiceProviderTorus({
      postboxKey: isEmptyProvider ? null : PRIVATE_KEY,
      customAuthArgs: {
        // this url has no effect as postbox key is passed
        // passing it just to satisfy direct auth checks.
        baseUrl: "http://localhost:3000",
      },
    });
  }
  return new ServiceProviderBase({ postboxKey: isEmptyProvider ? null : PRIVATE_KEY });
}
export function initStorageLayer(extraParams) {
  return new MockStorageLayer(extraParams);
}
function compareBNArray(a, b, message) {
  if (a.length !== b.length) throw new Error(message);
  return a.map((el) => {
    // console.log(el, b[index], el.cmp(b[index]));
    const found = b.find((pl) => pl.cmp(el) === 0);
    if (!found) throw new Error(message);
    return 0;
  });
}
export const PromiseHelperAllSettled = (promises) => {
  return Promise.all(promises.map(function (promise) {
      return promise.then(function (value) {
          return { status: 'fulfilled', value: value };
      }).catch(function (reason) {
          return { status: 'rejected', reason: reason };
      });
  }));
};

const sharedTest = async (mode, torusSP, storageLayer) => {
  const customSP = torusSP;
  const customSL = storageLayer;
  describe("test", () => {
    let tb;
    beforeEach(async() => {
      tb = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
    });
  
    test("dsa", ()=> {
      console.log({tb});
      let a = 1;
      assert(a, 1);
    });
  
    test("#should be able to initializeNewKey using initialize and reconstruct it", async function () {
      const sp = customSP;
      sp.postboxKey = new BN(getTempKey(), "hex");
      const storageLayer = initStorageLayer({ hostUrl: metadataURL });
      const tb2 = new ThresholdKey({ serviceProvider: sp, storageLayer, manualSync: mode });
      await tb2.initialize();
      const reconstructedKey = await tb2.reconstructKey();
      await tb2.syncLocalMetadataTransitions();
      if (tb2.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key when initializing a key, manualSync=${mode}`, async function () {
      // creating new device share and input that to store to reconstruct priv key
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();
  
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ neverInitializeNewKey: true });
      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key when initializing with user input, manualSync=${mode}`, async function () {
      // creating new user share and input that to store to reconstruct priv key
      let determinedShare = new BN(keccak256("user answer blublu").slice(2), "hex");
      determinedShare = determinedShare.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ determinedShare, initializeModules: true });
      // eslint-disable-next-line no-console
      console.log({ resp1: JSON.stringify(resp1) });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize();
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(tb2.shares));
      tb2.inputShareStore(resp1.userShare);
      const reconstructedKey = await tb2.reconstructKey();
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(tb2.shares));
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key when initializing with service provider, manualSync=${mode}`, async function () {
      const importedKey = new BN(generatePrivate());
      const resp1 = await tb._initializeNewKey({ importedKey, initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize();
      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey();
      if (importedKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key when initializing a with a share, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ withShare: resp1.userShare });
      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key after refresh and initializing with a share, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });
      const newShares = await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ withShare: resp1.userShare });
      tb2.inputShareStore(newShares.newShareStores[newShares.newShareIndex.toString("hex")]);
      const reconstructedKey = await tb2.reconstructKey();
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key after refresh and initializing with service provider, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });
      const newShares = await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize();
      tb2.inputShareStore(newShares.newShareStores[newShares.newShareIndex.toString("hex")]);
      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key, even with old metadata, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize(); // initialize sdk with old metadata

      await tb.generateNewShare(); // generate new share to update metadata
      await tb.syncLocalMetadataTransitions();

      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey(); // reconstruct key with old metadata should work to poly
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to not create a new key if initialize is called with neverInitializeNewKey, manualSync=${mode}`, async function () {
      const newSP = getServiceProvider({ type: torusSP.serviceProviderName });
      const tb2 = new ThresholdKey({ serviceProvider: newSP, storageLayer: customSL });
      await rejects(async () => {
        await tb2.initialize({ neverInitializeNewKey: true });
      }, Error);
    });
    test(`#should be able to output unavailable share store, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      const { newShareStores, newShareIndex } = await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ neverInitializeNewKey: true });
      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey();
      const shareStore = tb2.outputShareStore(newShareIndex);
      strictEqual(newShareStores[newShareIndex.toString("hex")].share.share.toString("hex"), shareStore.share.share.toString("hex"));

      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to update metadata, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();
      // nonce 0

      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize();
      tb2.inputShareStore(resp1.deviceShare);
      await tb2.reconstructKey();

      // try creating new shares
      await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      // In autoSync, generateNewShare will throw
      // in manualSync, syncLocalMetadataTransitions will throw
      await rejects(async () => {
        await tb2.generateNewShare();
        await tb2.syncLocalMetadataTransitions();
      }, Error);

      // try creating again
      const newtb = await tb2.updateSDK();
      await newtb.reconstructKey();
      await newtb.generateNewShare();
      await newtb.syncLocalMetadataTransitions();
    });
  });

  describe(`tkey share deletion, manualSync=${mode}`, function () {
    let deletedShareIndex;
    let deletedShareStores;
    let shareStoreAfterDelete;
    let tb;
    let tbInitResp;
    beforeEach(async() => {
      tb = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      tbInitResp = await tb._initializeNewKey({ initializeModules: true });
      const newShare = await tb.generateNewShare();
      const updatedShareStore = await tb.deleteShare(newShare.newShareIndex);
      deletedShareIndex = newShare.newShareIndex;
      deletedShareStores = newShare.newShareStores;
      shareStoreAfterDelete = updatedShareStore.newShareStores;
      await tb.syncLocalMetadataTransitions();
    });
    test(`#should be not be able to lookup delete share, manualSync=${mode}`, async function () {
      const newKeys = Object.keys(shareStoreAfterDelete);
      if (newKeys.find((el) => el === deletedShareIndex.toString("hex"))) {
        fail("Unable to delete share index");
      }
    });
    test(`#should not be able to delete more than threshold number of shares, manualSync=${mode}`, async function () {
      const { newShareIndex: newShareIndex1 } = await tb.generateNewShare();
      await tb.deleteShare(newShareIndex1);
      await tb.syncLocalMetadataTransitions();
      await rejects(async () => {
        await tb.deleteShare(tbInitResp.deviceShare.share.shareIndex);
      }, Error);
    });
    test(`#should not be able to initialize with a deleted share, manualSync=${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await rejects(async function () {
        await tb2.initialize({ withShare: deletedShareStores[deletedShareIndex.toString("hex")] });
      });
    });
    test(`#should not be able to add share post deletion, manualSync=${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize();
      await rejects(async () => {
        await tb2.inputShare(deletedShareStores[deletedShareIndex.toString("hex")].share.share);
      }, Error);
    });
  });

  //
  describe("tkey serialization/deserialization", function () {
    let tb;
    beforeEach(async() => {
      tb = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
    });
    test(`#should serialize and deserialize correctly without tkeyArgs, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });
      await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      const stringified = JSON.stringify(tb);
      const tb3 = await ThresholdKey.fromJSON(JSON.parse(stringified));
      const finalKey = await tb3.reconstructKey();
      strictEqual(finalKey.privKey.toString("hex"), resp1.privKey.toString("hex"), "Incorrect serialization");
    });
    test(`#should serialize and deserialize correctly with tkeyArgs, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });
      await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      const stringified = JSON.stringify(tb);
      const tb3 = await ThresholdKey.fromJSON(JSON.parse(stringified), { serviceProvider: customSP, storageLayer: customSL });
      const finalKey = await tb3.reconstructKey();
      strictEqual(finalKey.privKey.toString("hex"), resp1.privKey.toString("hex"), "Incorrect serialization");
    });
    test(`#should serialize and deserialize correctly, keeping localTransitions consistent before syncing NewKeyAssign, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });

      // generate and delete
      const { newShareIndex: shareIndex1 } = await tb.generateNewShare();
      await tb.deleteShare(shareIndex1);

      const { newShareStores: shareStores, newShareIndex: shareIndex } = await tb.generateNewShare();

      const stringified = JSON.stringify(tb);
      const tb2 = await ThresholdKey.fromJSON(JSON.parse(stringified), { serviceProvider: customSP, storageLayer: customSL });
      if (tb2.manualSync !== mode) {
        fail(`manualSync should be ${mode}`);
      }
      const finalKey = await tb2.reconstructKey();
      const shareToVerify = tb2.outputShareStore(shareIndex);
      strictEqual(shareStores[shareIndex.toString("hex")].share.share.toString("hex"), shareToVerify.share.share.toString("hex"));
      await tb2.syncLocalMetadataTransitions();
      strictEqual(finalKey.privKey.toString("hex"), resp1.privKey.toString("hex"), "Incorrect serialization");

      const reconstructedKey2 = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey2.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should serialize and deserialize correctly keeping localTransitions  afterNewKeyAssign, manualSync=${mode}`, async function () {
      let userInput = new BN(keccak256("user answer blublu").slice(2), "hex");
      userInput = userInput.umod(ecCurve.curve.n);
      const resp1 = await tb._initializeNewKey({ userInput, initializeModules: true });
      await tb.syncLocalMetadataTransitions();
      const reconstructedKey = await tb.reconstructKey();
      const { newShareStores: shareStores, newShareIndex: shareIndex } = await tb.generateNewShare();

      const stringified = JSON.stringify(tb);
      const tb2 = await ThresholdKey.fromJSON(JSON.parse(stringified), { serviceProvider: customSP, storageLayer: customSL });
      const finalKey = await tb2.reconstructKey();
      const shareToVerify = tb2.outputShareStore(shareIndex);
      strictEqual(shareStores[shareIndex.toString("hex")].share.share.toString("hex"), shareToVerify.share.share.toString("hex"));
      await tb2.syncLocalMetadataTransitions();
      strictEqual(finalKey.privKey.toString("hex"), reconstructedKey.privKey.toString("hex"), "Incorrect serialization");

      const reconstructedKey2 = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey2.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });

    test(`#should be able to reshare a key and retrieve from service provider serialization, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      const { newShareStores, newShareIndex } = await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();
      const tb3 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb3.initialize();
      tb3.inputShareStore(newShareStores[newShareIndex.toString("hex")]);

      const stringified = JSON.stringify(tb3);
      const tb4 = await ThresholdKey.fromJSON(JSON.parse(stringified), { serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      const finalKeyPostSerialization = await tb4.reconstructKey();
      strictEqual(finalKeyPostSerialization.privKey.toString("hex"), resp1.privKey.toString("hex"), "Incorrect serialization");
    });
    test(`#should be able to serialize and deserialize without service provider share or the postbox key, manualSync=${mode}`, async function () {
      const customSP2 = getServiceProvider({ type: torusSP.serviceProviderName });
      const customSL2 = initStorageLayer({ hostUrl: metadataURL });
      const tb = new ThresholdKey({ serviceProvider: customSP2, storageLayer: customSL2, manualSync: mode });
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      const { newShareStores: newShareStores1, newShareIndex: newShareIndex1 } = await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      const customSP3 = getServiceProvider({ type: torusSP.serviceProviderName, isEmptyProvider: true });
      customSL2.serviceProvider = customSP3;
      const tb2 = new ThresholdKey({ serviceProvider: customSP2, storageLayer: customSL2, manualSync: mode });
      await tb2.initialize({ withShare: resp1.deviceShare });
      tb2.inputShareStore(newShareStores1[newShareIndex1.toString("hex")]);
      await tb2.reconstructKey();
      const stringified = JSON.stringify(tb2);

      const tb3 = await ThresholdKey.fromJSON(JSON.parse(stringified));
      const tb3Key = await tb3.reconstructKey();
      strictEqual(tb3Key.privKey.toString("hex"), resp1.privKey.toString("hex"), "Incorrect serialization");
    });
    test(`#should not be able to updateSDK with newKeyAssign transitions unsynced, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });
      const stringified = JSON.stringify(tb);
      const tb2 = await ThresholdKey.fromJSON(JSON.parse(stringified), {});

      if (mode) {
        // Can't updateSDK, please do key assign.
        await rejects(async function () {
          await tb2.updateSDK();
        }, Error);
      }

      // create new key because the state might have changed after updateSDK()
      const tb3 = await ThresholdKey.fromJSON(JSON.parse(stringified), {});
      await tb3.generateNewShare();
      await tb3.syncLocalMetadataTransitions();
      await tb3.updateSDK();
    });
  });

  describe("StorageLayer", function () {
    test(`#should get or set correctly, manualSync=${mode}`, async function () {
      const tsp = getServiceProvider({ type: torusSP.serviceProviderName });
      const storageLayer = initStorageLayer({ hostUrl: metadataURL });
      const message = { test: Math.random().toString(36).substring(7) };
      await storageLayer.setMetadata({ input: message, privKey: tsp.postboxKey });
      const resp = await storageLayer.getMetadata({ privKey: tsp.postboxKey });
      deepStrictEqual(resp, message, "set and get message should be equal");
    });
    test(`#should get or set with specified private key correctly, manualSync=${mode}`, async function () {
      const privKey = generatePrivate().toString("hex");
      const privKeyBN = new BN(privKey, 16);
      const storageLayer = initStorageLayer({ hostUrl: metadataURL });
      const message = { test: Math.random().toString(36).substring(7) };
      await storageLayer.setMetadata({ input: message, privKey: privKeyBN });
      const resp = await storageLayer.getMetadata({ privKey: privKeyBN });
      deepStrictEqual(resp, message, "set and get message should be equal");
    });
    test(`#should be able to get/set bulk correctly, manualSync=${mode}`, async function () {
      const privkeys = [];
      const messages = [];
      for (let i = 0; i < 10; i += 1) {
        privkeys.push(new BN(generatePrivate()));
        messages.push({ test: Math.random().toString(36).substring(7) });
      }
      const storageLayer = initStorageLayer({ hostUrl: metadataURL });
      await storageLayer.setMetadataStream({ input: [...messages], privKey: [...privkeys] });
      const responses = await Promise.all(privkeys.map((el) => storageLayer.getMetadata({ privKey: el })));
      for (let i = 0; i < 10; i += 1) {
        deepStrictEqual(responses[i], messages[i], "set and get message should be equal");
      }
    });
  });

  describe("SecurityQuestionsModule", function () {
    let tb;
    beforeEach(async function () {
      tb = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule() },
        manualSync: mode,
      });
    });
    test(`#should be able to reconstruct key and initialize a key with security questions, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await rejects(async function () {
        await tb.modules.securityQuestions.inputShareFromSecurityQuestions("blublu");
      }, Error);

      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions("blublu", "who is your cat?");
      await tb.syncLocalMetadataTransitions();
      const question = tb.modules.securityQuestions.getSecurityQuestions();
      strictEqual(question, "who is your cat?");
      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule() },
      });
      await tb2.initialize();

      // wrong password
      await rejects(async function () {
        await tb.modules.securityQuestions.inputShareFromSecurityQuestions("blublu-wrong");
      }, Error);

      await tb2.modules.securityQuestions.inputShareFromSecurityQuestions("blublu");
      const reconstructedKey = await tb2.reconstructKey();
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to delete and add security questions, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions("blublu", "who is your cat?");
      await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      // delete sq
      const sqIndex = tb.metadata.generalStore.securityQuestions.shareIndex;
      await tb.deleteShare(sqIndex);

      // add sq again
      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions("blubluss", "who is your cat?");
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule() },
      });
      await tb2.initialize();

      await tb2.modules.securityQuestions.inputShareFromSecurityQuestions("blubluss");
      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to reconstruct key and initialize a key with security questions after refresh, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions("blublu", "who is your cat?");
      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule() },
      });
      await tb.generateNewShare();
      await tb.syncLocalMetadataTransitions();

      await tb2.initialize();

      await tb2.modules.securityQuestions.inputShareFromSecurityQuestions("blublu");
      const reconstructedKey = await tb2.reconstructKey();
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to change password, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });

      // should throw
      await rejects(async function () {
        await tb.modules.securityQuestions.changeSecurityQuestionAndAnswer("dodo", "who is your cat?");
      }, Error);

      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions("blublu", "who is your cat?");
      await tb.modules.securityQuestions.changeSecurityQuestionAndAnswer("dodo", "who is your cat?");
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule() },
      });
      await tb2.initialize();

      await tb2.modules.securityQuestions.inputShareFromSecurityQuestions("dodo");
      const reconstructedKey = await tb2.reconstructKey();
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to change password and serialize, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions("blublu", "who is your cat?");
      await tb.modules.securityQuestions.changeSecurityQuestionAndAnswer("dodo", "who is your cat?");
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule() },
      });
      await tb2.initialize();

      await tb2.modules.securityQuestions.inputShareFromSecurityQuestions("dodo");
      const reconstructedKey = await tb2.reconstructKey();
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }

      const stringified = JSON.stringify(tb2);
      const tb3 = await ThresholdKey.fromJSON(JSON.parse(stringified), { serviceProvider: customSP, storageLayer: customSL });
      const finalKeyPostSerialization = await tb3.reconstructKey();
      strictEqual(finalKeyPostSerialization.toString("hex"), reconstructedKey.toString("hex"), "Incorrect serialization");
    });
    test(`#should be able to get answers, even when they change, manualSync=${mode}`, async function () {
      tb = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule(true) },
      });
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      const qn = "who is your cat?";
      const ans1 = "blublu";
      const ans2 = "dodo";
      await tb.modules.securityQuestions.generateNewShareWithSecurityQuestions(ans1, qn);
      let gotAnswer = await tb.modules.securityQuestions.getAnswer();
      if (gotAnswer !== ans1) {
        fail("answers should be the same");
      }
      await tb.modules.securityQuestions.changeSecurityQuestionAndAnswer(ans2, qn);
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        storageLayer: customSL,
        modules: { securityQuestions: new SecurityQuestionsModule(true) },
      });
      await tb2.initialize();

      await tb2.modules.securityQuestions.inputShareFromSecurityQuestions("dodo");
      const reconstructedKey = await tb2.reconstructKey();
      // compareBNArray(resp1.privKey, reconstructedKey, "key should be able to be reconstructed");
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }

      gotAnswer = await tb2.modules.securityQuestions.getAnswer();
      if (gotAnswer !== ans2) {
        fail("answers should be the same");
      }
    });
  });

  describe("ShareTransferModule", function () {
    let tb;
    beforeEach(async() => {
      tb = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: { shareTransfer: new ShareTransferModule() },
      });
    });
    test(`#should be able to transfer share via the module, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: { shareTransfer: new ShareTransferModule() },
      });
      await tb2.initialize();

      // usually should be called in callback, but mocha does not allow
      const pubkey = await tb2.modules.shareTransfer.requestNewShare();

      const result = await tb.generateNewShare();
  
      await tb.modules.shareTransfer.approveRequest(pubkey, result.newShareStores[result.newShareIndex.toString("hex")]);
      await tb.syncLocalMetadataTransitions();

      await tb2.modules.shareTransfer.startRequestStatusCheck(pubkey);

      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });

    test(`#should be able to change share transfer pointer after share deletion, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });
      const firstShareTransferPointer = tb.metadata.generalStore.shareTransfer.pointer.toString("hex");
      const { newShareIndex: newShareIndex1 } = await tb.generateNewShare();
      const secondShareTransferPointer = tb.metadata.generalStore.shareTransfer.pointer.toString("hex");

      strictEqual(firstShareTransferPointer, secondShareTransferPointer);

      await tb.syncLocalMetadataTransitions();
      await tb.deleteShare(newShareIndex1);
      const thirdShareTransferPointer = tb.metadata.generalStore.shareTransfer.pointer.toString("hex");

      notStrictEqual(secondShareTransferPointer, thirdShareTransferPointer);
      await tb.syncLocalMetadataTransitions();
    });

    test(`#should be able to transfer device share, manualSync=${mode}`, async function () {
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: { shareTransfer: new ShareTransferModule() },
      });
      await tb2.initialize();
      const currentShareIndexes = tb2.getCurrentShareIndexes();
      // usually should be called in callback, but mocha does not allow
      const pubkey = await tb2.modules.shareTransfer.requestNewShare("unit test", currentShareIndexes);

      const requests = await tb.modules.shareTransfer.getShareTransferStore();
      const pubkey2 = Object.keys(requests)[0];
      await tb.modules.shareTransfer.approveRequest(pubkey2);

      await tb2.modules.shareTransfer.startRequestStatusCheck(pubkey, true);

      // await new Promise((res) => {
      //   setTimeout(res, 1001);
      // });

      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
    test(`#should be able to delete share transfer from another device, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: { shareTransfer: new ShareTransferModule() },
      });
      await tb2.initialize();

      // usually should be called in callback, but mocha does not allow
      const encKey2 = await tb2.modules.shareTransfer.requestNewShare();
      await tb.modules.shareTransfer.deleteShareTransferStore(encKey2); // delete 1st request from 2nd
      const newRequests = await tb2.modules.shareTransfer.getShareTransferStore();
      // console.log(newRequests)
      if (encKey2 in newRequests) {
        fail("Unable to delete share transfer request");
      }
    });
    test(`#should be able to reset share transfer store, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      await tb.modules.shareTransfer.resetShareTransferStore();
      const newRequests = await tb.modules.shareTransfer.getShareTransferStore();
      if (Object.keys(newRequests).length !== 0) {
        fail("Unable to reset share store");
      }
    });
  });

  //
  describe("ShareSerializationModule", function () {
    test(`#should be able to serialize and deserialize share, manualSync=${mode}`, async function () {
      const tb = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
      });
      const resp1 = await tb._initializeNewKey({ initializeModules: true });

      // should throw
      await rejects(async function () {
        await tb.outputShare(resp1.deviceShare.share.shareIndex, "mnemonic-49");
      });

      const exportedSeedShare = await tb.outputShare(resp1.deviceShare.share.shareIndex, "mnemonic");
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
      });
      await tb2.initialize();

      // should throw
      await rejects(async function () {
        await tb2.inputShare(exportedSeedShare.toString("hex"), "mnemonic-49");
      });

      await tb2.inputShare(exportedSeedShare.toString("hex"), "mnemonic");
      const reconstructedKey = await tb2.reconstructKey();

      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
    });
  });

  describe("TkeyStore", function () {
    let tb;
    let metamaskSeedPhraseFormat;
    let secp256k1Format;
    let ed25519privateKeyFormat;
    beforeEach(async function () {
      metamaskSeedPhraseFormat = new MetamaskSeedPhraseFormat("https://mainnet.infura.io/v3/bca735fdbba0408bb09471e86463ae68");
      secp256k1Format = new SECP256K1Format();
      ed25519privateKeyFormat = new ED25519Format();
      tb = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: {
          seedPhrase: new SeedPhraseModule([metamaskSeedPhraseFormat]),
          privateKeyModule: new PrivateKeyModule([secp256k1Format, ed25519privateKeyFormat]),
        },
      });
    });
    test(`#should not to able to initalize without seedphrase formats, manualSync=${mode}`, async function () {
      const seedPhraseToSet = "seed sock milk update focus rotate barely fade car face mechanic mercy";
      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: { seedPhrase: new SeedPhraseModule([]), privateKeyModule: new PrivateKeyModule([]) },
      });
      await tb2._initializeNewKey({ initializeModules: true });
      // should throw
      await rejects(async () => {
        await tb2.modules.seedPhrase.setSeedPhrase("HD Key Tree", seedPhraseToSet);
      }, Error);

      await rejects(async () => {
        await tb2.modules.seedPhrase.setSeedPhrase("HD Key Tree", `${seedPhraseToSet}123`);
      }, Error);

      // should throw
      await rejects(async () => {
        const actualPrivateKeys = [new BN("4bd0041b7654a9b16a7268a5de7982f2422b15635c4fd170c140dc4897624390", "hex")];
        await tb2.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[0].toString("hex"));
      }, Error);

      await rejects(async () => {
        const actualPrivateKeys = [new BN("4bd0041a9b16a7268a5de7982f2422b15635c4fd170c140dc48976wqerwer0", "hex")];
        await tb2.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[0].toString("hex"));
      }, Error);
    });
    test(`#should get/set multiple seed phrase, manualSync=${mode}`, async function () {
      const seedPhraseToSet = "seed sock milk update focus rotate barely fade car face mechanic mercy";
      const seedPhraseToSet2 = "object brass success calm lizard science syrup planet exercise parade honey impulse";
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree", seedPhraseToSet);
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree", seedPhraseToSet2);
      await tb.syncLocalMetadataTransitions();
      const returnedSeed = await tb.modules.seedPhrase.getSeedPhrases();
      strictEqual(returnedSeed[0].seedPhrase, seedPhraseToSet);
      strictEqual(returnedSeed[1].seedPhrase, seedPhraseToSet2);

      const metamaskSeedPhraseFormat2 = new MetamaskSeedPhraseFormat("https://mainnet.infura.io/v3/bca735fdbba0408bb09471e86463ae68");
      const tb2 = new ThresholdKey({
        serviceProvider: customSP,
        manualSync: mode,
        storageLayer: customSL,
        modules: { seedPhrase: new SeedPhraseModule([metamaskSeedPhraseFormat2]) },
      });
      await tb2.initialize();
      tb2.inputShareStore(resp1.deviceShare);
      const reconstuctedKey = await tb2.reconstructKey();
      await tb.modules.seedPhrase.getSeedPhrasesWithAccounts();

      compareReconstructedKeys(reconstuctedKey, {
        privKey: resp1.privKey,
        seedPhraseModule: [
          new BN("70dc3117300011918e26b02176945cc15c3d548cf49fd8418d97f93af699e46", "hex"),
          new BN("bfdb025a1d404212c3f9ace6c5fb4185087281dcb9c1e89087d1a3a423f80d22", "hex"),
        ],
        allKeys: [
          resp1.privKey,
          new BN("70dc3117300011918e26b02176945cc15c3d548cf49fd8418d97f93af699e46", "hex"),
          new BN("bfdb025a1d404212c3f9ace6c5fb4185087281dcb9c1e89087d1a3a423f80d22", "hex"),
        ],
      });
    });
    test(`#should be able to derive keys, manualSync=${mode}`, async function () {
      const seedPhraseToSet = "seed sock milk update focus rotate barely fade car face mechanic mercy";
      await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree", seedPhraseToSet);
      await tb.syncLocalMetadataTransitions();

      const actualPrivateKeys = [new BN("70dc3117300011918e26b02176945cc15c3d548cf49fd8418d97f93af699e46", "hex")];
      const derivedKeys = await tb.modules.seedPhrase.getAccounts();
      compareBNArray(actualPrivateKeys, derivedKeys, "key should be same");
    });

    test(`#should be able to generate seed phrase if not given, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree");
      await tb.syncLocalMetadataTransitions();

      const [seed] = await tb.modules.seedPhrase.getSeedPhrases();
      const derivedKeys = await tb.modules.seedPhrase.getAccounts();
      strict(metamaskSeedPhraseFormat.validateSeedPhrase(seed.seedPhrase), "Seed Phrase must be valid");
      strict(derivedKeys.length >= 1, "Atleast one account must be generated");
    });

    test(`#should be able to change seedphrase, manualSync=${mode}`, async function () {
      const oldSeedPhrase = "verb there excuse wink merge phrase alien senior surround fluid remind chef bar move become";
      await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree", oldSeedPhrase);
      // await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree");
      await tb.syncLocalMetadataTransitions();

      const newSeedPhrase = "trim later month olive fit shoulder entry laptop jeans affair belt drip jealous mirror fancy";
      await tb.modules.seedPhrase.CRITICAL_changeSeedPhrase(oldSeedPhrase, newSeedPhrase);
      await tb.syncLocalMetadataTransitions();

      const secondStoredSeedPhrases = await tb.modules.seedPhrase.getSeedPhrases();

      strictEqual(secondStoredSeedPhrases[0].seedPhrase, newSeedPhrase);
    });

    test(`#should be able to replace numberOfWallets seed phrase module, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree");
      await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree");
      const seedPhraseStores = await tb.modules.seedPhrase.getSeedPhrases();
      // console.log("%O", tb.metadata.tkeyStore);
      await tb.modules.seedPhrase.setSeedPhraseStoreItem({
        id: seedPhraseStores[1].id,
        seedPhrase: seedPhraseStores[1].seedPhrase,
        numberOfWallets: 2,
      });
      await tb.syncLocalMetadataTransitions();

      // console.log(storedSeedPhrase);
      const secondStoredSeedPhrases = await tb.modules.seedPhrase.getSeedPhrases();
      strictEqual(secondStoredSeedPhrases[0].numberOfWallets, 1);
      strictEqual(secondStoredSeedPhrases[1].numberOfWallets, 2);
    });

    test(`#should be able to get/set private key, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });

      const actualPrivateKeys = [
        new BN("4bd0041b7654a9b16a7268a5de7982f2422b15635c4fd170c140dc4897624390", "hex"),
        new BN("1ea6edde61c750ec02896e9ac7fe9ac0b48a3630594fdf52ad5305470a2635c0", "hex"),
        new BN(
          "7a3118ccdd405b2750271f51cc8fe237d9863584173aec3fa4579d40e5b4951215351c3d54ef416e49567b79c42fd985fcda60a6da9a794e4e844ac8dec47e98",
          "hex"
        ),
      ];
      await tb.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[0]);
      await tb.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[1]);
      await tb.modules.privateKeyModule.setPrivateKey("ed25519", actualPrivateKeys[2]);
      await tb.syncLocalMetadataTransitions();
      await tb.modules.privateKeyModule.getAccounts();

      const getAccounts = await tb.modules.privateKeyModule.getAccounts();
      deepStrictEqual(
        actualPrivateKeys.map((x) => x.toString("hex")),
        getAccounts.map((x) => x.toString("hex"))
      );
    });

    test(`#should be able to get/set private key, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });

      const actualPrivateKeys = [
        new BN("4bd0041b7654a9b16a7268a5de7982f2422b15635c4fd170c140dc4897624390", "hex"),
        new BN("1ea6edde61c750ec02896e9ac7fe9ac0b48a3630594fdf52ad5305470a2635c0", "hex"),
        new BN(
          "99da9559e15e913ee9ab2e53e3dfad575da33b49be1125bb922e33494f4988281b2f49096e3e5dbd0fcfa9c0c0cd92d9ab3b21544b34d5dd4a65d98b878b9922",
          "hex"
        ),
      ];

      await tb.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[0]);
      await tb.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[1]);
      await tb.modules.privateKeyModule.setPrivateKey("ed25519", actualPrivateKeys[2]);
      await tb.syncLocalMetadataTransitions();
      await tb.modules.privateKeyModule.getAccounts();

      const getAccounts = await tb.modules.privateKeyModule.getAccounts();
      deepStrictEqual(
        actualPrivateKeys.map((x) => x.toString("hex")),
        getAccounts.map((x) => x.toString("hex"))
      );
    });

    test(`#should be able to generate private key if not given, manualSync=${mode}`, async function () {
      await tb._initializeNewKey({ initializeModules: true });

      await tb.modules.privateKeyModule.setPrivateKey("secp256k1n");
      await tb.modules.privateKeyModule.setPrivateKey("secp256k1n");
      await tb.modules.privateKeyModule.setPrivateKey("ed25519");
      await tb.syncLocalMetadataTransitions();

      const accounts = await tb.modules.privateKeyModule.getAccounts();
      strictEqual(accounts.length, 3);
    });

    // test(`#should be able to get/set private keys and seed phrase, manualSync=${mode}`, async function () {
    //   const resp1 = await tb._initializeNewKey({ initializeModules: true });

    //   await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree", "seed sock milk update focus rotate barely fade car face mechanic mercy");
    //   await tb.modules.seedPhrase.setSeedPhrase("HD Key Tree", "chapter gas cost saddle annual mouse chef unknown edit pen stairs claw");

    //   const actualPrivateKeys = [
    //     new BN("4bd0041b7654a9b16a7268a5de7982f2422b15635c4fd170c140dc4897624390", "hex"),
    //     new BN("1ea6edde61c750ec02896e9ac7fe9ac0b48a3630594fdf52ad5305470a2635c0", "hex"),
    //   ];
    //   await tb.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[0]);
    //   await tb.modules.privateKeyModule.setPrivateKey("secp256k1n", actualPrivateKeys[1]);
    //   await tb.syncLocalMetadataTransitions();

    //   const metamaskSeedPhraseFormat2 = new MetamaskSeedPhraseFormat("https://mainnet.infura.io/v3/bca735fdbba0408bb09471e86463ae68");
    //   const tb2 = new ThresholdKey({
    //     serviceProvider: customSP,
    //     manualSync: mode,
    //     storageLayer: customSL,
    //     modules: { seedPhrase: new SeedPhraseModule([metamaskSeedPhraseFormat2]), privateKeyModule: new PrivateKeyModule([secp256k1Format]) },
    //   });
    //   await tb2.initialize();
    //   tb2.inputShareStore(resp1.deviceShare);
    //   const reconstructedKey = await tb2.reconstructKey();

    //   compareReconstructedKeys(reconstructedKey, {
    //     privKey: resp1.privKey,
    //     seedPhraseModule: [
    //       new BN("70dc3117300011918e26b02176945cc15c3d548cf49fd8418d97f93af699e46", "hex"),
    //       new BN("4d62a55af3496a7b290a12dd5fd5ef3e051d787dbc005fb74536136949602f9e", "hex"),
    //     ],
    //     privateKeyModule: [
    //       new BN("4bd0041b7654a9b16a7268a5de7982f2422b15635c4fd170c140dc4897624390", "hex"),
    //       new BN("1ea6edde61c750ec02896e9ac7fe9ac0b48a3630594fdf52ad5305470a2635c0", "hex"),
    //     ],
    //     allKeys: [
    //       resp1.privKey,
    //       new BN("70dc3117300011918e26b02176945cc15c3d548cf49fd8418d97f93af699e46", "hex"),
    //       new BN("4d62a55af3496a7b290a12dd5fd5ef3e051d787dbc005fb74536136949602f9e", "hex"),
    //       new BN("4bd0041b7654a9b16a7268a5de7982f2422b15635c4fd170c140dc4897624390", "hex"),
    //       new BN("1ea6edde61c750ec02896e9ac7fe9ac0b48a3630594fdf52ad5305470a2635c0", "hex"),
    //     ],
    //   });

    //   const reconstructedKey2 = await tb2.reconstructKey(false);
    //   compareReconstructedKeys(reconstructedKey2, {
    //     privKey: resp1.privKey,
    //     allKeys: [resp1.privKey],
    //   });
    // });
  });

  describe("Lock", function () {
    test(`#locks should fail when tkey/nonce is updated, manualSync=${mode}`, async function () {
      const tb = new ThresholdKey({ serviceProvider: customSP, manualSync: mode, storageLayer: customSL });
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, manualSync: mode, storageLayer: customSL });
      await tb2.initialize();
      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
      await tb2.generateNewShare();
      await tb2.syncLocalMetadataTransitions();

      await rejects(
        async () => {
          await tb.generateNewShare();
          await tb.syncLocalMetadataTransitions();
        },
        (err) => {
          strictEqual(err.code, 1401, "Expected aquireLock failed error is not thrown");
          return true;
        }
      );
    });

    test(`#locks should not allow for writes of the same nonce, manualSync=${mode}`, async function () {
      const tb = new ThresholdKey({ serviceProvider: customSP, manualSync: mode, storageLayer: customSL });
      const resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();

      const tb2 = new ThresholdKey({ serviceProvider: customSP, manualSync: mode, storageLayer: customSL });
      await tb2.initialize();
      tb2.inputShareStore(resp1.deviceShare);
      const reconstructedKey = await tb2.reconstructKey();
      if (resp1.privKey.cmp(reconstructedKey.privKey) !== 0) {
        fail("key should be able to be reconstructed");
      }
      const alltbs = [];
      // make moar tbs
      for (let i = 0; i < 5; i += 1) {
        const temp = new ThresholdKey({ serviceProvider: customSP, manualSync: mode, storageLayer: customSL });
        await temp.initialize();
        temp.inputShareStore(resp1.deviceShare);
        await temp.reconstructKey();
        alltbs.push(temp);
      }
      // generate shares
      const promises = [];
      for (let i = 0; i < alltbs.length; i += 1) {
        promises.push(alltbs[i].generateNewShare().then((_) => alltbs[i].syncLocalMetadataTransitions()));
      }
      const res = await PromiseHelperAllSettled(promises);
      console.log({res});
      let count = 0;
      for (let i = 0; i < res.length; i += 1) {
        if (res[i].status === "fulfilled") count += 1;
      }
      console.log({count});
      if (count !== 1) {
        fail("fulfilled count != 1");
      }
    });
  });

  describe("OneKey", function () {
    if (!mode || isMocked) return;

    test("should be able to init tkey with 1 out of 1", async function () {
      const postboxKeyBN = new BN(generatePrivate(), "hex");
      const pubKeyPoint = getPubKeyPoint(postboxKeyBN);

      const serviceProvider = new TorusServiceProvider({
        postboxKey: postboxKeyBN.toString("hex"),
        customAuthArgs: {
          enableOneKey: true,
          metadataUrl: getMetadataUrl(),
          // This url has no effect as postbox key is passed, passing it just to satisfy direct auth checks.
          baseUrl: "http://localhost:3000",
        },
      });
      const storageLayer2 = new TorusStorageLayer({ hostUrl: getMetadataUrl() });

      const { typeOfUser, nonce, pubNonce } = await serviceProvider.directWeb.torus.getOrSetNonce(
        pubKeyPoint.x.toString("hex"),
        pubKeyPoint.y.toString("hex"),
        postboxKeyBN
      );
      equal(typeOfUser, "v2");
      notEqual(nonce, undefined);
      notEqual(pubNonce, undefined);

      const nonceBN = new BN(nonce, "hex");
      const importKey = postboxKeyBN.add(nonceBN).umod(serviceProvider.directWeb.torus.ec.curve.n).toString("hex");

      const tKey = new ThresholdKey({ serviceProvider, storageLayer: storageLayer2, manualSync: mode });
      await tKey.initialize({
        importKey: new BN(importKey, "hex"),
        delete1OutOf1: true,
      });
      await tKey.syncLocalMetadataTransitions();
      equal(tKey.privKey.toString("hex"), importKey);

      const {
        typeOfUser: newTypeOfUser,
        nonce: newNonce,
        pubNonce: newPubNonce,
        upgraded,
      } = await serviceProvider.directWeb.torus.getOrSetNonce(pubKeyPoint.x.toString("hex"), pubKeyPoint.y.toString("hex"), postboxKeyBN);
      equal(upgraded, true);
      equal(newTypeOfUser, "v2");
      equal(newNonce, undefined);
      deepEqual(pubNonce, newPubNonce);
    });

    test("should not change v1 address without a custom nonce when getOrSetNonce is called", async function () {
      // Create an existing v1 account
      const postboxKeyBN = new BN(generatePrivate(), "hex");
      const pubKeyPoint = getPubKeyPoint(postboxKeyBN);

      // This test require development API, only work with local/beta env
      let metadataUrl = getMetadataUrl();
      if (metadataUrl === "https://metadata.tor.us") metadataUrl = "https://metadata-testing.tor.us";
      await post(
        `${metadataUrl}/set_nonce`,
        {
          pub_key_X: pubKeyPoint.x.toString("hex"),
          pub_key_Y: pubKeyPoint.y.toString("hex"),
        },
        undefined,
        { useAPIKey: true }
      );

      // Call get or set nonce
      const serviceProvider = new TorusServiceProvider({
        postboxKey: postboxKeyBN.toString("hex"),
        customAuthArgs: {
          enableOneKey: true,
          metadataUrl,
          // This url has no effect as postbox key is passed, passing it just to satisfy direct auth checks.
          baseUrl: "http://localhost:3000",
        },
      });

      const res = await serviceProvider.directWeb.torus.getOrSetNonce(pubKeyPoint.x.toString("hex"), pubKeyPoint.y.toString("hex"), postboxKeyBN);
      equal(res.typeOfUser, "v1");

      const anotherRes = await serviceProvider.directWeb.torus.getOrSetNonce(
        pubKeyPoint.x.toString("hex"),
        pubKeyPoint.y.toString("hex"),
        postboxKeyBN
      );
      deepEqual(res, anotherRes);
    });

    it("should not change v1 address with a custom nonce when getOrSetNonce is called", async function () {
      // Create an existing v1 account with custom key
      const postboxKeyBN = new BN(generatePrivate(), "hex");
      const pubKeyPoint = getPubKeyPoint(postboxKeyBN);
      const customKey = generatePrivate().toString("hex");

      const serviceProvider = new TorusServiceProvider({
        postboxKey: postboxKeyBN.toString("hex"),
        customAuthArgs: {
          enableOneKey: true,
          metadataUrl: getMetadataUrl(),
          // This url has no effect as postbox key is passed, passing it just to satisfy direct auth checks.
          baseUrl: "http://localhost:3000",
        },
      });
      await serviceProvider.directWeb.torus.setCustomKey({ torusKeyHex: postboxKeyBN.toString("hex"), customKeyHex: customKey.toString("hex") });

      // Compare nonce returned from v1 API and v2 API
      const getMetadataNonce = await serviceProvider.directWeb.torus.getMetadata({
        pub_key_X: pubKeyPoint.x.toString("hex"),
        pub_key_Y: pubKeyPoint.y.toString("hex"),
      });
      const getOrSetNonce = await serviceProvider.directWeb.torus.getOrSetNonce(
        pubKeyPoint.x.toString("hex"),
        pubKeyPoint.y.toString("hex"),
        postboxKeyBN
      );
      equal(getOrSetNonce.typeOfUser, "v1");
      equal(getOrSetNonce.nonce, getMetadataNonce.toString("hex"));
    });
  });

  describe("tkey error cases", function () {
    let tb;
    let resp1;
    let sandbox;

    beforeEach(async function () {
      sandbox = createSandbox();
      tb = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      resp1 = await tb._initializeNewKey({ initializeModules: true });
      await tb.syncLocalMetadataTransitions();
    });
    afterEach(function () {
      sandbox.restore();
    });
    test(`#should throw error code 1101 if metadata is undefined, in manualSync: ${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await rejects(
        async () => {
          await tb2.reconstructKey();
        },
        (err) => {
          strictEqual(err.code, 1101, "Expected metadata error is not thrown");
          return true;
        }
      );
      await rejects(
        async () => {
          tb2.getMetadata();
        },
        (err) => {
          strictEqual(err.code, 1101, "Expected metadata error is not thrown");
          return true;
        }
      );
      await rejects(
        async () => {
          await tb2.deleteShare();
        },
        (err) => {
          strictEqual(err.code, 1101, "Expected metadata error is not thrown");
          return true;
        }
      );
      await rejects(
        async () => {
          await tb2.generateNewShare();
        },
        (err) => {
          strictEqual(err.code, 1101, "Expected metadata error is not thrown");
          return true;
        }
      );
      const exportedSeedShare = await tb.outputShare(resp1.deviceShare.share.shareIndex, "mnemonic");
      await rejects(
        async () => {
          await tb2.inputShare(exportedSeedShare, "mnemonic");
        },
        (err) => {
          strictEqual(err.code, 1101, "Expected metadata error is not thrown");
          return true;
        }
      );
    });
    test(`#should throw error code 1301 if privKey is not available, in manualSync: ${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ neverInitializeNewKey: true });
      await rejects(
        async () => {
          await tb2.generateNewShare();
        },
        (err) => {
          strictEqual(err.code, 1301, "Expected 1301 error is not thrown");
          return true;
        }
      );
      await rejects(
        async () => {
          await tb2.deleteShare();
        },
        (err) => {
          strictEqual(err.code, 1301, "Expected 1301 error is not thrown");
          return true;
        }
      );
      await rejects(
        async () => {
          await tb2.encrypt(Buffer.from("test data"));
        },
        (err) => {
          strictEqual(err.code, 1301, "Expected 1301 error is not thrown");
          return true;
        }
      );
    });
    test(`#should throw error code 1302 if not enough shares are avaible for reconstruction, in manualSync: ${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ neverInitializeNewKey: true });
      await rejects(
        async () => {
          await tb2.reconstructKey();
        },
        (err) => {
          strictEqual(err.code, 1302, "Expected 1302 error is not thrown");
          return true;
        }
      );
    });

    test(`#should throw error code 1102 if metadata get failed, in manualSync: ${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      sandbox.stub(tb2.storageLayer, "getMetadata").throws(new Error("failed to fetch metadata"));
      await rejects(
        async () => {
          await tb2.initialize({ neverInitializeNewKey: true });
        },
        (err) => {
          strictEqual(err.code, 1102, "Expected 1102 error is not thrown");
          return true;
        }
      );
    });

    test(`#should throw error code 1103 if metadata post failed, in manualSync: ${mode}`, async function () {
      const tb2 = new ThresholdKey({ serviceProvider: customSP, storageLayer: customSL, manualSync: mode });
      await tb2.initialize({ neverInitializeNewKey: true });
      tb2.inputShareStore(resp1.deviceShare);
      await tb2.reconstructKey();
      await tb2.syncLocalMetadataTransitions();
      sandbox.stub(tb2.storageLayer, "setMetadataStream").throws(new Error("failed to set metadata"));
      if (mode) {
        await rejects(
          async () => {
            await tb2.addShareDescription(resp1.deviceShare.share.shareIndex.toString("hex"), JSON.stringify({ test: "unit test" }), true);
            await tb2.syncLocalMetadataTransitions();
          },
          (err) => {
            strictEqual(err.code, 1103, "Expected 1103 error is not thrown");
            return true;
          }
        );
      } else {
        await rejects(
          async () => {
            await tb2.addShareDescription(resp1.deviceShare.share.shareIndex.toString("hex"), JSON.stringify({ test: "unit test" }), true);
          },
          (err) => {
            strictEqual(err.code, 1103, "Expected 1103 error is not thrown");
            return true;
          }
        );
      }
    });
  });
}

sharedTest(false, torusSP, initStorageLayer());