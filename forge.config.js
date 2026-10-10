module.exports = {
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "me",
          name: "awesome-thing",
        },
        prerelease: false,
      },
    },
  ],
  packagerConfig: {
    asar: true,
    icon: "./src/assets/taraneem",
    // The private database editor is a repository tool, never part of an app package.
    ignore: [
      /^\/tools(?:\/|$)/,
      /^\/forge\.config\.js$/,
      /^\/scripts\/test-release-config\.js$/,
    ],
  },
  hooks: {
    postPackage: async (_config, packageResult) => {
      const { verifyPackagedApp } = require("./tools/song-editor/packageGuard");
      for (const outputPath of packageResult.outputPaths) verifyPackagedApp(outputPath);
    },
  },
  rebuildConfig: {},
  makers: [
    {
      name: "@electron-forge/maker-squirrel",
      config: {
        iconUrl:
          "https://drive.google.com/file/d/1bC1KhN7uF6Xln-D-OTlJUH2aGRrRB9Lc/view?usp=sharing",
        setupIcon: "./src/assets/taraneem.ico",
      },
    },
    {
      name: "@electron-forge/maker-zip",
      platforms: ["darwin"],
    },
    {
      name: "@electron-forge/maker-deb",
      config: {
        options: {
          icon: "/src/assets/taraneem square logo.png",
        },
      },
    },
    {
      name: "@electron-forge/maker-rpm",
      config: {},
    },
  ],
  plugins: [
    // {
    //   name: "@electron-forge/plugin-auto-unpack-natives",
    //   config: {},
    // },
    // {
    //   name: "@electron-forge/plugin-github-publisher",
    //   config: {
    //     repositoryUrl: "https://github.com/NaderMakram/taraneem",
    //   },
    // },
  ],
};
