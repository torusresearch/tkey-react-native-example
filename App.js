import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import "./global";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import CustomAuth from "@toruslabs/customauth-react-native-sdk";
import {
  Button,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Web3 from "web3";
import ThresholdKey from "@tkey/default";
import TorusServiceProvider from "@tkey/service-provider-base";
import TorusStorageLayer from "@tkey/storage-layer-torus";
import * as ec from "@toruslabs/eccrypto";
import BN from "bn.js";
import { getED25519Key } from "@toruslabs/openlogin-ed25519";
import base58 from "bs58";
import { Keypair } from "@solana/web3.js";
import { sign } from "tweetnacl";
import { ShareTransferModule } from "@tkey/share-transfer";
import crypto from "crypto-browserify";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { onOpen, Picker } from "react-native-actions-sheet-picker";

const GOOGLE = "google";
const verifierMap = {
  [GOOGLE]: {
    name: "Google",
    typeOfLogin: "google",
    clientId:
      "221898609709-obfn3p63741l5333093430j3qeiinaa8.apps.googleusercontent.com",
    verifier: "google-lrc",
  },
};

const directParams = {
  baseUrl: `http://localhost:3000/serviceworker/`,
  enableLogging: true,
  network: "testnet",
};
const serviceProvider = new TorusServiceProvider({
  customAuthArgs: directParams,
});
const storageLayer = new TorusStorageLayer({
  hostUrl: "https://metadata.tor.us",
});
const shareTransferModule = new ShareTransferModule();

const tKey = new ThresholdKey({
  serviceProvider: serviceProvider,
  storageLayer,
  modules: { shareTransfer: shareTransferModule },
});

function HomeScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [authVerifier, setAuthVerifier] = useState("google");
  const [shareDetails, setShareDetails] = useState("0x0");
  const [postboxKey, setPostboxKey] = useState("");
  const addLog = useCallback((log) => {
    setLogs((logs) => [">" + JSON.stringify(log), ...logs]);
  }, []);

  useEffect(() => {
    const init = async () => {
      // Init Service Provider
      try {
        window.navigator.userAgent = "ReactNative";
      } catch (error) {
        addLog({ error });
      }
    };
    init();
    try {
      const result = CustomAuth.init({
        browserRedirectUri: "https://scripts.toruswallet.io/redirect.html",
        redirectUri: "torusapp://org.torusresearch.customauthexample/redirect",
        network: "testnet", // details for test net
        enableLogging: true,
        enableOneKey: false,
      });
    } catch (error) {
      addLog(error, "mounted caught");
    }
  }, []);

  const initializetKey = async () => {
    try {
      let key = await tKey.initialize();
      addLog({ key });
    } catch (err) {
      addLog({ err });
    }
  };

  const createTkey = async () => {
    try {
      tKey.serviceProvider.postboxKey = new BN(ec.generatePrivate());
      await initializetKey();

      const res = await tKey._initializeNewKey({ initializeModules: true });
      addLog(res);

      setShareDetails(res.privKey.toString("hex"));
      addLog(res.privKey);
    } catch (err) {
      addLog("error while createTkey", err);
    }
  };

  const reconstructKey = async () => {
    try {
      const res = await tKey.reconstructKey();
      addLog(res.privKey);
    } catch (err) {
      addLog("error while createTkey", err);
    }
  };

  const getTKeyDetails = async () => {
    try {
      addLog(tKey.getKeyDetails());
    } catch (err) {
      addLog("error while createTkey", err);
    }
  };

  const generateShares = async () => {
    try {
      const newShare = await tKey.generateNewShare();
      addLog({ newShare });
    } catch (err) {
      addLog("generate shares", err);
    }
  };

  const deleteShares = async () => {
    try {
      const shareIndex = await tKey.getCurrentShareIndexes();
      addLog({ shareIndex });
      const deleteShare = await tKey.deleteShare(
        shareIndex[shareIndex.length - 1]
      );
      addLog({ deleteShare });
    } catch (err) {
      addLog({ err });
    }
  };

  const requestShare = async () => {
    try {
      const res = await tKey.modules.shareTransfer.requestNewShare(
        navigator.userAgent,
        tKey.getCurrentShareIndexes()
      );
      addLog(res);
    } catch (error) {
      addLog({ error });
    }
  };

  const approveShareRequest = async () => {
    addLog("Approving Share Request");
    try {
      const result = await tKey.modules.shareTransfer.getShareTransferStore();
      const share_store = await tKey.generateNewShare();

      const pubkey2 = Object.keys(result)[0];
      addLog({ result });

      await tKey.modules.shareTransfer.approveRequest(
        pubkey2,
        share_store.newShareStores[share_store.newShareIndex.toString("hex")]
      );
      addLog("Approved Share Transfer request");
    } catch (err) {
      addLog(err);
    }
  };

  const login = async () => {
    try {
      const { typeOfLogin, clientId, verifier, jwtParams } =
        verifierMap[authVerifier];
      const loginDetails = await CustomAuth.triggerLogin({
        typeOfLogin,
        verifier,
        clientId,
        jwtParams,
      });
      addLog({ loginDetails });

      let pbKey = new BN(loginDetails.privateKey, "hex");
      tKey.serviceProvider.postboxKey = pbKey;
      setPostboxKey(pbKey);

      let keyDetails = await tKey.initialize(); // metadata is from the above step
      addLog({ keyDetails });
    } catch (error) {
      addLog(error, "login caught");
    }
  };

  const checkShareRequests = async () => {
    addLog("Checking Share Requests");
    try {
      const requests = await tKey.modules.shareTransfer.lookForRequests();
      addLog("Share Requests" + JSON.stringify(requests));
    } catch (err) {
      addLog(err);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#17171D" }}>
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
          <Button title="Create new Tkey" onPress={createTkey}></Button>
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
            title="Reconstruct private key"
            onPress={reconstructKey}
          ></Button>
          <Button title="Delete Share" onPress={deleteShares}></Button>
          <Button title="Get Tkey Details" onPress={getTKeyDetails}></Button>
          <Button title="Generate Shares" onPress={generateShares}></Button>

          <Button
            title="Sol & Eth Screen"
            onPress={() => navigation.navigate("SolEthKey")}
          ></Button>
          <Button
            title="ECDH Screen"
            onPress={() => navigation.navigate("ecdh")}
          ></Button>

          <Button title="Login" onPress={login}></Button>

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

function SolEthKeyScreen() {
  const web3 = new Web3();
  const [solKeyPair, setSolKeyPair] = useState();
  const [ethWallet, setEthWallet] = useState();
  const [logs, setLogs] = useState([]);

  const getSolKey = () => {
    try {
      let key = getED25519Key(tKey.privKey.toString("hex"));
      addLog(key.pk);
      addLog(base58.encode(key.sk));
      addLog(key.sk.byteLength);

      let sk = Keypair.fromSecretKey(key.sk);
      setSolKeyPair(sk);
      addLog(`pubKey ${sk.publicKey}`);
      addLog(`sk ${base58.encode(sk.secretKey)}`);
    } catch (err) {
      addLog({ err });
    }
  };

  const signMessageSol = () => {
    try {
      const signedMessage = sign.detached(
        Buffer.from("test", "utf-8"),
        solKeyPair.secretKey
      );
      const signedHex = Buffer.from(signedMessage).toString("hex");
      addLog({ signedHex });
    } catch (err) {
      addLog("Check if sol and tkey has been generated", err);
    }
  };

  const createEthWallet = () => {
    try {
      let pKey = tKey.privKey.toString("hex");

      const account = web3.eth.accounts.privateKeyToAccount(pKey);
      setEthWallet(account);
      addLog(account.address);
      addLog(account.privateKey);
    } catch (err) {
      addLog("Check if tkey has been generated", err);
    }
  };

  const signEthMessage = () => {
    try {
      const signMessage = web3.eth.accounts.sign(
        "hello world",
        ethWallet.privateKey
      );
      addLog({ signMessage });
    } catch (err) {
      addLog("Check if eth wallet and tkey has been generated", err);
    }
  };

  const addLog = useCallback((log) => {
    setLogs((logs) => [">" + JSON.stringify(log), ...logs]);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#17171D" }}>
      <Button title="Get sol key" onPress={getSolKey}></Button>
      <Button title="Sign Message Sol" onPress={signMessageSol}></Button>
      <Button title="Create EthWallet" onPress={createEthWallet}></Button>
      <Button title="Sign EthMessage" onPress={signEthMessage}></Button>

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
  const [logs, setLogs] = useState([]);
  const [data, setData] = useState([]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const countries = [{ name: "secp256k1" }, { name: "ed25519" }];
  const styles = StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
    },
    button: {
      backgroundColor: "#8B93A5",
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
          .toLocaleLowerCase("en")
          .includes(query.toLocaleLowerCase("en"))
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

  const addLog = useCallback((log) => {
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
          onOpen("Curve");
        }}
      >
        <Text>{selected || `Choose Curve`}</Text>
      </TouchableOpacity>
      <Text
        style={{
          fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace",
          color: "#fff",
          fontSize: 14,
        }}
      >
        selected Curve: ${selected}
      </Text>
      <Picker
        id="Curve"
        data={filteredData}
        inputValue={query}
        searchable={true}
        label="Select Curve"
        setSelected={(value) => {
          setSelected(value.name);
        }}
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

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="home" component={HomeScreen} />
        <Stack.Screen name="ecdh" component={EcdhScreen} />
        <Stack.Screen name="SolEthKey" component={SolEthKeyScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
