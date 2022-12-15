import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./global";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Platform,
  ScrollView,
  Text,
  TouchableHighlight,
  TouchableHighlightProps,
  View,
} from "react-native";
import { StatusBar } from "expo-status-bar";
// import * as Linking from "expo-linking";
// import nacl from "tweetnacl";
// import bs58 from "bs58";
// import { generateKey } from "crypto";
import * as crypto from "crypto-js";
// import * as ec from "eccrypto"
import * as ec from "@toruslabs/eccrypto";
//const NETWORK = clusterApiUrl("mainnet-beta");
// import * as ab from "torusbridge";
//const buildUrl = (path: string, params: URLSearchParams) =>
//  `https://solflare.com/ul/${path}?${params.toString()}`;
import ThresholdKey from "@tkey/default";
import WebStorageModule, { WEB_STORAGE_MODULE_NAME } from "@tkey/web-storage";
import TorusServiceProvider from "@tkey/service-provider-torus";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import { UX_MODE } from "@toruslabs/customauth";
import BN from "bn.js";

const GOOGLE = "google";
const FACEBOOK = "facebook";
const LINKEDIN = "linkedin";
const TWITTER = "twitter";
const AUTH_DOMAIN = "https://torus-test.auth0.com";

const loginConnectionMap: Record<string, any> = {
  [LINKEDIN]: { domain: AUTH_DOMAIN },
  [TWITTER]: { domain: AUTH_DOMAIN },
};

const verifierMap: Record<string, any> = {
  [GOOGLE]: {
    name: "Google",
    typeOfLogin: "google",
    clientId: "134678854652-vnm7amoq0p23kkpkfviveul9rb26rmgn.apps.googleusercontent.com",
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
  uxMode: UX_MODE.REDIRECT,
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

  const addLog = useCallback((log: string) => setLogs((logs) => [...logs, "> " + log]), []);
  let a = ec.generatePrivate();

  useEffect(() => {
    // (async () => {
    //   try {
    //     // const res = await tKey.generateNewShare();
    //     // addLog(JSON.stringify(res));
    //     // console.log(JSON.stringify(res));
    //     await (tKey.serviceProvider as TorusServiceProvider).init({ skipSw: false });
    //     console.log("init resolcvced");
    //   } catch(err) {

    //     console.log("err",err);
    //     addLog(JSON.stringify(err));
    //   }
    // })();
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
    // let a =  ec.generatePrivate()
    // addLog(a.toString());
    // let abs = ec.encrypt('m message', 'secret key 123').toString();
    // let a = generatePrivate();
    // addLog(a.toString());
    // generateKey('hmac', {length: 64}, (err, result)=> {
    //   console.log({err}, {result})
    // });
    // var ciphertext = crypto.AES.encrypt('m message', 'secret key 123').toString();
    // addLog(ciphertext);
  }, []);
  const triggerLogin = async () => {
    try {
      console.log("Triggering init");

      // 2. Set jwtParameters depending on the verifier (google / facebook / linkedin etc)
      // const jwtParams = loginConnectionMap[authVerifier] || {};

      // const { typeOfLogin, clientId, verifier } = verifierMap[authVerifier];

      // 3. Trigger Login ==> opens the popup
      // const loginResponse = await (tKey.serviceProvider as TorusServiceProvider).triggerLogin({
      //   typeOfLogin,
      //   verifier,
      //   clientId,
      //   jwtParams,
      // });
      try {
        let key = await tKey.initialize();
        console.log({key});
      } catch(err) {
        console.log({err});
      }

      // addLog(JSON.stringify(loginResponse));
      // setConsoleText(loginResponse);
    } catch (error) {
      console.log(error);
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
          <Button title="click login" onPress={triggerLogin}>
          </Button>
        </ScrollView>
      </View>
    </View>
  );
}
