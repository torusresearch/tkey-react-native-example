module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      "babel-preset-expo",
      {
        exclude: [
          "transform-async-to-generator",
          "transform-regenerator",
          "transform-exponentiation-operator", // this line here
        ],
      },
    ],
  };
};
