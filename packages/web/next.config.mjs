export default {
  reactStrictMode: true,
  transpilePackages: ["@support-copilot/core"],
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },
};
