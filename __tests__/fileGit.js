// const axios = require("axios");
import axios from "axios";
import { promises as fs } from "fs";

export const fetchJsFile = async () => {
  describe("shared.js", () => {
    it("fetch and write to shared js file", async () => {
      try {
        const { data: response } = await axios.get(
          "https://raw.githubusercontent.com/tkey/tkey/master/packages/default/test/shared.js"
        );
        await fs.writeFile("./__tests__/shared.js", response);
      } catch (err) {
        console.error({ err });
      }
    });
  });
};
