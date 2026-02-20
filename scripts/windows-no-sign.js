"use strict";

exports.default = async function noSign(configuration) {
  // Intentionally skip Windows code signing in automated builds.
  if (configuration && configuration.path) {
    console.log(`Skipping code signing for ${configuration.path}`);
  }
};
