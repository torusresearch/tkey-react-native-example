# React Native Template

This project It provides core dependencies, and boilerplate to jumpstart development using @toruslabs/customauth-react-native-sdk(https://github.com/torusresearch/customauth-react-native-sdk).

## Prerequisites

- [Node.js > 12](https://nodejs.org) and npm (Recommended: Use [nvm](https://github.com/nvm-sh/nvm))
- [Xcode 12](https://developer.apple.com/xcode)
- [Cocoapods 1.10.1](https://cocoapods.org)

changes done:
1. metro.config.js -> using node-libs-react-native (https://www.npmjs.com/package/node-libs-react-native) to provide polyfilled libs for React Native compatible implementations of Node core modules like stream, http, etc..
2. global.js -> have global variables which will be required for toruslabs packages to work in react native context


steps to run sample app:
1. yarn install
2. cd ios && pod install
3. yarn ios

steps to test shared js file:
1. yarn test (we are getting updated tests from https://raw.githubusercontent.com/tkey/tkey/master/packages/default/test/shared.js and running in react native context)

what features are there in app?
1. create new tkey
2. generate share
3. delete share
4. share request module: request, approve, check for share request
5. get tkey details 
6. login - google login powered by custom auth
7. Sol Screen 
    * get sol key derived from eth key using @toruslabs/openlogin-ed25519(https://www.npmjs.com/package/@toruslabs/openlogin-ed25519)
    * supports sign in with solana features: @web3auth/sign-in-with-web3
        sign message and verify the signature output after message is signed
8. Eth Screen 
    * creates ethereum wallet using tkey's privKey
    * supports sign in with solana features: @web3auth/sign-in-with-web3
        sign message and verify the signature output after message is signed
9. ECDH Screen 
    * create different curves using crypto.createECDH functions
    * curves implemented: secp256k1 and ed25519