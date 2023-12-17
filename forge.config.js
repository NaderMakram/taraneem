module.exports = {
  packagerConfig: {
    asar: true,
    icon: "./src/assets/taraneem",
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
    {
      name: "@electron-forge/plugin-auto-unpack-natives",
      config: {},
    },
    {
      name: "@electron-forge/plugin-github-publisher",
      config: {
        repositoryUrl: "https://github.com/NaderMakram/taraneem",
      },
    },
  ],
};
