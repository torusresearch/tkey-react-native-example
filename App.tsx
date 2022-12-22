import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./global";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Web3 from "web3";
import { StatusBar } from "expo-status-bar";
import ThresholdKey from "@tkey/default";
import TorusServiceProvider from "@tkey/service-provider-torus";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import * as ec from "@toruslabs/eccrypto";
import CustomAuth from "@toruslabs/customauth-react-native-sdk";
import { getED25519Key } from "@toruslabs/openlogin-ed25519";
import BN from "bn.js";
import base58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { sign } from "tweetnacl";
import { ShareTransferModule } from "@tkey/share-transfer";
import crypto from "crypto-browserify";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onOpen, Picker } from "react-native-actions-sheet-picker";

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
    clientId:
      "221898609709-obfn3p63741l5333093430j3qeiinaa8.apps.googleusercontent.com",
    verifier: "web3auth-testnet-verifier",
  },
  [FACEBOOK]: {
    name: "Facebook",
    typeOfLogin: "facebook",
    clientId: "617201755556395",
    verifier: "facebook-lrc",
  },
  [LINKEDIN]: {
    name: "Linkedin",
    typeOfLogin: "linkedin",
    clientId: "59YxSgx79Vl3Wi7tQUBqQTRTxWroTuoc",
    verifier: "torus-auth0-linkedin-lrc",
  },
  [TWITTER]: {
    name: "Twitter",
    typeOfLogin: "twitter",
    clientId: "A7H8kkcmyFRlusJQ9dZiqBLraG2yWIsO",
    verifier: "torus-auth0-twitter-lrc",
  },
};
const directParams = {
  baseUrl: `http://localhost:3000/serviceworker/`,
  enableLogging: true,
  network: "testnet" as any,
  // uxMode: UX_MODE.REDIRECT,
};
const serviceProvider = new TorusServiceProvider({
  ...directParams,
  customAuthArgs: directParams,
});
const storageLayer = new TorusStorageLayer({
  hostUrl: "https://metadata.tor.us",
});
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

function HomeScreen({ navigation }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [authVerifier, setAuthVerifier] = useState<string>("google");
  const [shareDetails, setShareDetails] = useState<string>("0x0");
  const [total, setTotal] = useState<number>(3);
  const [threshold, setThreshold] = useState<number>(2);
  const addLog = useCallback((log: any) => {
    setLogs((logs) => [">" + JSON.stringify(log), ...logs]);
  }, []);

  useEffect(() => {
    const init = async () => {
      // Init Service Provider
      try {
        console.log("init in");
        (window.navigator as any).userAgent = "ReactNative";
        // await (tKey.serviceProvider as TorusServiceProvider).init({ skipInit: true, });
        tKey.serviceProvider.postboxKey = new BN(ec.generatePrivate());

        console.log("init resolved");
      } catch (error) {
        console.error(error);
      }
    };
    init();
    // try {
    //   // console.log({ CustomAuth });
    //   const result = CustomAuth.init({
    //     browserRedirectUri: "https://scripts.toruswallet.io/redirect.html",
    //     redirectUri: "torusapp://org.torusresearch.customauthexample/redirect",
    //     network: "testnet", // details for test net
    //     enableLogging: true,
    //     enableOneKey: false,
    //   });
    //   console.log({ result });
    // } catch (error) {
    //   console.error(error, "mounted caught");
    // }
  }, []);

  // const initializetKey = async () => {
  //   try {
  //     // let key = await CustomAuth.getTorusKey();
  //     // console.log({key});
  //     console.log("Triggering init");
  //     try {
  //       let key = await tKey.initialize();
  //       console.log({ key });
  //     } catch (err) {
  //       console.log({ err });
  //     }
  //   } catch (error) {
  //     console.log(error);
  //   }
  // };

  const login = async () => {
    try {
      const { typeOfLogin, clientId, verifier, jwtParams } =
        verifierMap[authVerifier];
      console.log({ typeOfLogin });
      const loginDetails = await CustomAuth.triggerLogin({
        typeOfLogin,
        verifier,
        clientId,
        jwtParams,
      });
      addLog(loginDetails);
    } catch (error) {
      console.error(error, "login caught");
    }
  };

  const createTkey = async () => {
    try {
      const res = await tKey._initializeNewKey({ initializeModules: true });
      console.log(res);
      setShareDetails(res.privKey.toString("hex"));
      addLog(res.privKey);
    } catch (err) {
      console.error("error while createTkey", err);
    }
  };

  const reconstructKey = async () => {
    try {
      const res = await tKey.reconstructKey();
      console.log(res);
      addLog(res.privKey);
    } catch (err) {
      console.error("error while createTkey", err);
    }
  };

  const getTKeyDetails = async () => {
    try {
      addLog(tKey.getKeyDetails());
    } catch (err) {
      console.error("error while createTkey", err);
    }
  };

  const generateShares = async () => {
    const newShare = await tKey.generateNewShare();
    addLog({ newShare });
  };

  const requestShare = async () => {
    try {
      const res = await (
        tKey.modules.shareTransfer as ShareTransferModule
      ).requestNewShare(navigator.userAgent, tKey.getCurrentShareIndexes());
      addLog(res);
    } catch (error) {
      console.log({ error });
    }
  };

  const approveShareRequest = async () => {
    addLog("Approving Share Request");
    try {
      const result = await (
        tKey.modules.shareTransfer as ShareTransferModule
      ).getShareTransferStore();
      const requests = await (
        tKey.modules.shareTransfer as ShareTransferModule
      ).lookForRequests();
      const share_store = await tKey.generateNewShare();
      // const newShare = await tKey.generateNewShare();
      // shareToShare = newShare.newShareStores[newShare.newShareIndex.toString("hex")];
      const pubkey2 = Object.keys(result)[0];
      console.log(pubkey2);
      addLog({ result });
      // console.log(share_store, requests);
      // const shareStore = tKey.outputShareStore(requests[0]);
      // addLog({shareStore});

      await (tKey.modules.shareTransfer as ShareTransferModule).approveRequest(
        pubkey2,
        share_store.newShareStores[share_store.newShareIndex.toString("hex")]
      );
      // await tKey.syncLocalMetadataTransitions();
      addLog("Approved Share Transfer request");
      // await tKey._syncShareMetadata()
      const res = await (
        tKey.modules.shareTransfer as ShareTransferModule
      ).resetShareTransferStore();
    } catch (err) {
      console.error(err);
    }
  };

  const checkShareRequests = async () => {
    addLog("Checking Share Requests");
    try {
      // const result = await (tKey.modules.shareTransfer as ShareTransferModule).getShareTransferStore();
      const requests = await (
        tKey.modules.shareTransfer as ShareTransferModule
      ).lookForRequests();
      addLog("Share Requests" + JSON.stringify(requests));
      console.log("Share requests", requests);
      // console.log("Share Transfer Store", result);
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
            paddingTop: 10,
            flexGrow: 1,
          }}
          style={{ flex: 1 }}
        >
          <Button title="create new Tkey" onPress={createTkey}></Button>
          <Button title="Request new Share" onPress={requestShare}></Button>
          <Button
            title="Check Share Request"
            onPress={checkShareRequests}
          ></Button>
          <Button
            title="Approve Share Request"
            onPress={approveShareRequest}
          ></Button>
          <Button
            title="reconstruct private key"
            onPress={reconstructKey}
          ></Button>
          <Button title="get Tkey Details" onPress={getTKeyDetails}></Button>
          <Button title="generate Shares" onPress={generateShares}></Button>

          <Button
            title="Sol & Eth Screen"
            onPress={() => navigation.navigate("SolEthKey")}
          ></Button>
          <Button
            title="ECDH Screen"
            onPress={() => navigation.navigate("ecdh")}
          ></Button>
         
          {/* <Button title="login" onPress={login}></Button> */}

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
          <Text>shareDetails: {shareDetails}</Text>
        </ScrollView>
      </View>
    </View>
  );
}

function SolEthKeyScreen({ navigation }) {
  const web3 = new Web3();
  const [solKeyPair, setSolKeyPair] = useState<Keypair>(null);
  const [ethWallet, setEthWallet] = useState(null);
  const [logs, setLogs] = useState<string[]>([]);

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
    } catch (err) {
      console.log({ err });
    }
  };

  const signMessageSol = () => {
    const signedMessage = sign.detached(
      Buffer.from("test", "utf-8"),
      solKeyPair.secretKey
    );
    const signedHex = Buffer.from(signedMessage).toString("hex");
    addLog({ signedHex });
  };

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
  };

  const signEthMessage = () => {
    const signMessage = web3.eth.accounts.sign(
      "hello world",
      ethWallet.privateKey
    );
    addLog({ signMessage });
    console.log(signMessage);
  };

  const addLog = useCallback((log: any) => {
    setLogs((logs) => [">" + JSON.stringify(log), ...logs]);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#17171D" }}>
      <Button title="get sol key" onPress={getSolKey}></Button>
      <Button title="signMessageSol" onPress={signMessageSol}></Button>
      <Button title="createEthWallet" onPress={createEthWallet}></Button>
      <Button title="signEthMessage" onPress={signEthMessage}></Button>

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
    </View>
  );
}

function EcdhScreen() {
  const [logs, setLogs] = useState<string[]>([]);
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState(undefined);
  const [query, setQuery] = useState('');
  const countries = [
    {name: "secp256k1"},
    {name: "ed25519"},
  ]
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
    },
    button: {
      backgroundColor: '#8B93A5',
      padding: 10,
      borderRadius: 6,
      marginTop: 50,
    },
  });
  useEffect(() => {
    setData(countries);
  }, []);

  /*
   **Example filter function
   * @param {string} filter
   */
  const filteredData = useMemo(() => {
    if (data && data.length > 0) {
      return data.filter((item) =>
        item.name
          .toLocaleLowerCase('en')
          .includes(query.toLocaleLowerCase('en'))
      );
    }
  }, [data, query]);

  /*
   **Input search
   *@param {string} text
   */
  const onSearch = (text) => {
    setQuery(text);
  };

  const addLog = useCallback((log: any) => {
    setLogs((logs) => [">" + JSON.stringify(log), ...logs]);
  }, []);

  const ecdh = async () => {
    const type = selected || "ed25519";
    addLog(`Type:\t ${type}`);

    // Generate Alice's keys...
    const alice = crypto.createECDH(type);
    const aliceKey = alice.generateKeys();

    // Generate Bob's keys...
    const bob = crypto.createECDH(type);
    const bobKey = bob.generateKeys();

    addLog(`Alice private key: ${alice.getPrivateKey().toString("hex")}`);
    addLog(`Alice public key: ${aliceKey.toString("hex")}`);

    addLog(`Bob private key ${bob.getPrivateKey().toString("hex")}`);
    addLog(`Bob public key ${bobKey.toString("hex")}`);

    // Exchange and generate the secret...
    const aliceSecret = alice.computeSecret(bobKey);
    const bobSecret = bob.computeSecret(aliceKey);

    addLog(`Alice shared key: ${aliceSecret.toString("hex")}`);
    addLog(`Bob shared key: ${bobSecret.toString("hex")}`);
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: "#17171D" }}>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            onOpen('Curve');
          }}
        >
          <Text>{ selected || `Choose Curve` }</Text>
        </TouchableOpacity>
        <Text style={{
                fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
                color: "#fff",
                fontSize: 14,
              }}>selected Curve: ${selected}</Text>
        <Picker
          id="Curve"
          data={filteredData}
          inputValue={query}
          searchable={true}
          label="Select Curve"
          setSelected={(value) => {setSelected(value.name)}}
          onSearch={onSearch}
        />
      <Button title="trigger ECDH Functions" onPress={ecdh}></Button>

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
    </View>
  );
}

function TestScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#17171D" }}>
      <Text>Test Screen</Text>
    </View>
  );
}

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="home" component={HomeScreen} />
        <Stack.Screen name="ecdh" component={EcdhScreen} />
        <Stack.Screen name="test" component={TestScreen} />
        <Stack.Screen name="SolEthKey" component={SolEthKeyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
