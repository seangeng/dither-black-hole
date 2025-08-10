/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Add support for GLSL files
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      type: "asset/source",
    });

    return config;
  },
  experimental: {
    esmExternals: false,
  },
};

module.exports = nextConfig;
