import {decode, encode} from 'base-64'
console.log('global')
if (!global.btoa) {
    global.btoa = encode;
}

if (!global.atob) {
    global.atob = decode;
}

if(!global.Buffer) {
    global.Buffer = require("buffer/").Buffer;
}
console.log(global.process);
global.process.version = "v16.0.0";
if(!global.process) {
    global.process = require("process");
    console.log({process: global.process});
}