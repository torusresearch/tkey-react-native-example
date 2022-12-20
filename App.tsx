import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./global";
import {secrets} from "./secret";
import React, { useCallback, useEffect, useState } from "react";
import {
  Button,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import Web3 from "web3";
import { StatusBar } from "expo-status-bar";
import ThresholdKey from "@tkey/default";
import TorusServiceProvider from "@tkey/service-provider-torus";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import * as ec from "@toruslabs/eccrypto";
import CustomAuth from '@toruslabs/customauth-react-native-sdk';
import {getED25519Key} from "@toruslabs/openlogin-ed25519";
import BN from "bn.js";
import base58 from "bs58";
import {Keypair} from "@solana/web3.js";
import { sign } from "tweetnacl";
import { ShareTransferModule } from "@tkey/share-transfer";

declare global {
  interface Window {
    secrets: any;
  }
}

const GOOGLE = "google";
const FACEBOOK = "facebook";
const LINKEDIN = "linkedin";
const TWITTER = "twitter";
const AUTH_DOMAIN = "https://torus-test.auth0.com";
let shares: any;
const loginConnectionMap: Record<string, any> = {
  [LINKEDIN]: { domain: AUTH_DOMAIN },
  [TWITTER]: { domain: AUTH_DOMAIN },
};

const verifierMap: Record<string, any> = {
  [GOOGLE]: {
    name: "Google",
    typeOfLogin: "google",
    clientId: "221898609709-obfn3p63741l5333093430j3qeiinaa8.apps.googleusercontent.com",
    verifier: "web3auth-testnet-verifier",
  },
  [FACEBOOK]: { name: "Facebook", typeOfLogin: "facebook", clientId: "617201755556395", verifier: "facebook-lrc" },
  [LINKEDIN]: { name: "Linkedin", typeOfLogin: "linkedin", clientId: "59YxSgx79Vl3Wi7tQUBqQTRTxWroTuoc", verifier: "torus-auth0-linkedin-lrc" },
  [TWITTER]: { name: "Twitter", typeOfLogin: "twitter", clientId: "A7H8kkcmyFRlusJQ9dZiqBLraG2yWIsO", verifier: "torus-auth0-twitter-lrc" },
};
const directParams = {
  baseUrl: `http://localhost:3000/serviceworker/`,
  enableLogging: true,
  network: "testnet" as any,
  // uxMode: UX_MODE.REDIRECT,
};
const serviceProvider = new TorusServiceProvider({ ...directParams, customAuthArgs: directParams });
const storageLayer = new TorusStorageLayer({ hostUrl: "https://metadata.tor.us" });
const shareTransferModule = new ShareTransferModule();
// const webStorageModule = new WebStorageModule();

// addLog(JSON.stringify(a));

// addLog(JSON.stringify(tKey));
console.log("hi1");
const tKey = new ThresholdKey({
  serviceProvider: serviceProvider,
  storageLayer,
  modules: { shareTransfer: shareTransferModule },
});

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [authVerifier, setAuthVerifier] = useState<string>("google");
  const [shareDetails, setShareDetails] = useState<string>("0x0");
  const [total, setTotal] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  const [solKeyPair, setSolKeyPair] = useState<Keypair>(null);
  const web3 = new Web3();
  const [ethWallet, setEthWallet] = useState(null);
  const addLog = useCallback((log: any) => setLogs((logs) => [...logs, "> " + JSON.stringify(log)]), []);

  useEffect(() => {
    const init = async () => {
      // Init Service Provider
      try {
        console.log("init in");
        (window.navigator as any).userAgent = 'ReactNative';
        // await (tKey.serviceProvider as TorusServiceProvider).init({ skipInit: true, });
        tKey.serviceProvider.postboxKey = new BN(ec.generatePrivate());

        console.log("init resolved");
      } catch (error) {
        console.error(error);
      }
    };
    init();
    try {
      console.log({CustomAuth})
      const result = CustomAuth.init({
        browserRedirectUri: 'https://scripts.toruswallet.io/redirect.html',
        redirectUri: 'torusapp://org.torusresearch.customauthexample/redirect',
        network: 'testnet', // details for test net
        enableLogging: true,
        enableOneKey: false,
      });
      console.log({result});
    } catch (error) {
      console.error(error, 'mounted caught');
    }
  }, []);

  const initializetKey = async () => {
    try {
      // let key = await CustomAuth.getTorusKey();
      // console.log({key});
      console.log("Triggering init");
      try {
        let key = await tKey.initialize();
        console.log({key});
      } catch(err) {
        console.log({err});
      }
    } catch (error) {
      console.log(error);
    }
  };

  const login = async() => {
    try {
      const {typeOfLogin, clientId, verifier, jwtParams} =
        verifierMap[authVerifier];
      console.log({typeOfLogin});
      const loginDetails = await CustomAuth.triggerLogin({
        typeOfLogin,
        verifier,
        clientId,
        jwtParams,
      });
      addLog(loginDetails)
    } catch (error) {
      console.error(error, 'login caught');
    }
  }

  const createTkey = async() => {
    try {
      const res = await tKey._initializeNewKey({initializeModules: true});
      console.log(res);
      setShareDetails(res.privKey.toString("hex"));
      addLog(res.privKey);
    } catch(err) {
      console.error("error while createTkey", err);
    }
  }

  const reconstructKey = async() => {
    try {
      const res = await tKey.reconstructKey();
      console.log(res);
      addLog(res.privKey);
    } catch(err) {
      console.error("error while createTkey", err);
    }
  }

  const getTKeyDetails = async() => {
    try {
      addLog(tKey.getKeyDetails());
    } catch(err) {
      console.error("error while createTkey", err);
    }
  }

  const generateShares = async () => {
    const newShare = await tKey.generateNewShare();
    addLog({newShare});
    // var re = /[0-9A-Fa-f]*/g;
    // var keyToBeSplit = shareDetails.replaceAll('"', "");
    // if (keyToBeSplit.substring(0, 2) === "0x") {
    //   keyToBeSplit = keyToBeSplit.substring(2);
    // }
    // if (re.test(keyToBeSplit)) {
    //   var shares = secrets().share(keyToBeSplit, total, threshold);
    //   setShareDetails(shares.join("\n"));
    //   addLog("generated shares");
    //   addLog({shares})
    //   addLog({shareDetails})
    // } else {
    //   addLog("error in generating shares");
    // }
  };

  const getSolKey = () => {
    let key = getED25519Key(tKey.privKey.toString("hex"));
    addLog(key.pk);
    addLog(base58.encode(key.sk));
    try {
      console.log(key.sk.byteLength);
      let sk = Keypair.fromSecretKey(key.sk);
      setSolKeyPair(sk);
      addLog(`pubKey ${sk.publicKey}`);
      addLog(`sk ${base58.encode(sk.secretKey)}`);
    } catch(err) {
      console.log({err});
    }
  }

  const signMessageSol = () => {
    const signedMessage = sign.detached(Buffer.from("test", "utf-8"), solKeyPair.secretKey);
    const signedHex = Buffer.from(signedMessage).toString("hex");
    addLog({signedHex});
  }

  const createEthWallet = () => {
    let pKey = tKey.privKey.toString("hex");
    console.log(pKey);
    // let wallet = Wallet.fromPrivateKey(Buffer.from(pKey, "hex"));
    const account = web3.eth.accounts.privateKeyToAccount(pKey);
    setEthWallet(account);
    addLog(account.address);
    addLog(account.privateKey);
    // addLog({ethPub: wallet.getAddress().toString("hex")});
    // addLog({priv: wallet.getPrivateKeyString()});
  }

  const signEthMessage = () => {
    const signMessage = web3.eth.accounts.sign("hello world", ethWallet.privateKey);
    addLog({signMessage});
    console.log(signMessage);
  }

  const combineShares = () => {
    let comb = secrets().combine(shareDetails.split("\n"));
    setShareDetails(comb);
    addLog({shareDetails});
  }

  const requestShare = async () => {
    try {
      const res = await (tKey.modules.shareTransfer as ShareTransferModule).requestNewShare(navigator.userAgent, tKey.getCurrentShareIndexes());
      addLog(res);
    } catch (error) {
      console.log({error});
    }
  }


  const approveShareRequest = async () => {
    addLog("Approving Share Request");
    try {
      const result = await (tKey.modules.shareTransfer as ShareTransferModule).getShareTransferStore();
      const requests = await (tKey.modules.shareTransfer as ShareTransferModule).lookForRequests();
      let shareToShare;
      // const newShare = await tKey.generateNewShare();
      // shareToShare = newShare.newShareStores[newShare.newShareIndex.toString("hex")];
      // const pubkey2 = Object.keys(requests)[0];
      // console.log({result}, {requests}, {pubkey2});
      console.log(result, requests);
      const shareStore = tKey.outputShareStore(requests[0]);
      
      await (tKey.modules.shareTransfer as ShareTransferModule).approveRequest(requests[0], shareStore);
      // await this.tbsdk.modules.shareTransfer.deleteShareTransferStore(requests[0]) // delete old share requests
      addLog("Approved Share Transfer request");
    } catch (err) {
      console.error(err);
    }
  };

  const checkShareRequests = async () => {
    addLog("Checking Share Requests");
    try {
      const result = await (tKey.modules.shareTransfer as ShareTransferModule).getShareTransferStore();
      const requests = await (tKey.modules.shareTransfer as ShareTransferModule).lookForRequests();
      addLog("Share Requests" + JSON.stringify(requests));
      console.log("Share requests", requests);
      console.log("Share Transfer Store", result);
    } catch (err) {
      console.log(err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#17171D" }}>
      <StatusBar style="light" />
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{
            backgroundColor: "#111",
            padding: 20,
            paddingTop: 100,
            flexGrow: 1,
          }}
          style={{ flex: 1 }}
        >
          <Button title="initializetKey" onPress={initializetKey}>
          </Button>
          <Button title="login" onPress={login}>
          </Button>
          <Button title="create new Tkey" onPress={createTkey}>
          </Button>
          <Button title="get sol key" onPress={getSolKey}>
          </Button>
          <Button title="signMessageSol" onPress={signMessageSol}>
          </Button>
          <Button title="createEthWallet" onPress={createEthWallet}>
          </Button>
          <Button title="signEthMessage" onPress={signEthMessage}>
          </Button>
          <Button title="Request new Share" onPress={requestShare}>
          </Button>
          <Button title="Check Share Request" onPress={checkShareRequests}>
          </Button>
          <Button title="Approve Share Request" onPress={approveShareRequest}>
          </Button>
          <Button title="reconstruct private key" onPress={reconstructKey}>
          </Button>
          <Button title="get Tkey Details" onPress={getTKeyDetails}>
          </Button>
          <Button title="generate Shares" onPress={generateShares}>
          </Button>
          <Button title="combine Shares" onPress={combineShares}>
          </Button>

          {logs.map((log, i) => (
            <Text
              key={`t-${i}`}
              style={{
                fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
                color: "#fff",
                fontSize: 14,
              }}
            >
              {log}
            </Text>
          ))}
          <Text>
            shareDetails: {shareDetails}
          </Text>
        </ScrollView>
      </View>
    </View>
  );
}
