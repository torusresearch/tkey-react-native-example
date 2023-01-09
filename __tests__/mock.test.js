const { sharedTestCases } = require("./shared");
import { ServiceProviderBase } from "@tkey/service-provider-base";
import { MockStorageLayer, TorusStorageLayer } from "@tkey/storage-layer-torus";
import { fetchJsFile } from "./fileGit";

const PRIVATE_KEY =
  "f70fb5f5970b363879bc36f54d4fc0ad77863bfd059881159251f50f48863acc";
const torusSP = new ServiceProviderBase({
  postboxKey: PRIVATE_KEY,
});

export function initStorageLayer(mocked) {
  return mocked
    ? new MockStorageLayer()
    : new TorusStorageLayer({ hostUrl: "https://metadata.tor.us" });
}

(async () => {
  await fetchJsFile();
  await sharedTestCases(false, torusSP, initStorageLayer(true));
  await sharedTestCases(false, torusSP, initStorageLayer(true));
})();

