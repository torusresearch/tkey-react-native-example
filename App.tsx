import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./global";
import {secrets} from "./secret";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Platform,
  ScrollView,
  Text,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import ThresholdKey from "@tkey/default";
import TorusServiceProvider from "@tkey/service-provider-torus";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import * as ec from "@toruslabs/eccrypto";
import CustomAuth from '@toruslabs/customauth-react-native-sdk';
import {getED25519Key} from "@toruslabs/openlogin-ed25519";
import BN from "bn.js";
import base58 from "bs58";


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
// const webStorageModule = new WebStorageModule();

// addLog(JSON.stringify(a));

// addLog(JSON.stringify(tKey));
console.log("hi1");
const tKey = new ThresholdKey({
  serviceProvider: serviceProvider,
  storageLayer,
  // modules: { webStorage: webStorageModule },
});

export default function App() {
  const [logs, setLogs] = useState<string[]>([]);
  const [authVerifier, setAuthVerifier] = useState<string>("google");
  const [shareDetails, setShareDetails] = useState<string>("0x0");
  const [total, setTotal] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);

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

  const generateShares = () => {
    var re = /[0-9A-Fa-f]*/g;
    var keyToBeSplit = shareDetails.replaceAll('"', "");
    if (keyToBeSplit.substring(0, 2) === "0x") {
      keyToBeSplit = keyToBeSplit.substring(2);
    }
    if (re.test(keyToBeSplit)) {
      var shares = secrets().share(keyToBeSplit, total, threshold);
      setShareDetails(shares.join("\n"));
      addLog("generated shares");
      addLog({shares})
      addLog({shareDetails})
    } else {
      addLog("error in generating shares");
    }
  };

  const getSolKey = () => {
    let key = getED25519Key(tKey.privKey.toString());
    addLog(key.pk);
    addLog(base58.encode(key.sk));
  }

  const combineShares = () => {
    let comb = secrets().combine(shareDetails.split("\n"));
    setShareDetails(comb);
    addLog({shareDetails});
  }

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
