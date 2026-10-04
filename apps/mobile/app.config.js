// Expo merges app.json (the base) into `config` here. Only the build switches in build-flags.js are applied; with no environment variables set
// the result is app.json plus `extra: { distribution: "sideload", pilotTemplateIds: null }`, i.e. the same app as before.
const { applyBuildFlags } = require("./build-flags");

module.exports = ({ config }) => applyBuildFlags(config, process.env);
