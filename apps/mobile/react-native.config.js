// Native modules linked only on an explicit opt-in build (see plugins/apple-health-config.js).
const { appleHealthEnabled } = require("./plugins/apple-health-config");

const health = appleHealthEnabled(process.env);
const off = { platforms: { ios: null, android: null } };

module.exports = {
  dependencies: health
    ? { "@kingstinct/react-native-healthkit": { platforms: { android: null } }, "react-native-nitro-modules": { platforms: { android: null } } }
    : { "@kingstinct/react-native-healthkit": off, "react-native-nitro-modules": off, "@react-native-healthkit/core": off },
};
