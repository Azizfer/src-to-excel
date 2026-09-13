/** @type {import('next').NextConfig} */
const nextConfig = {
  // The app lives inside a larger repo checkout that has its own lockfile;
  // pin tracing to this package so serverless bundles stay correct.
  outputFileTracingRoot: new URL('.', import.meta.url).pathname,

  reactStrictMode: true,
  poweredByHeader: false,

  // tesseract.js resolves worker + wasm paths from node_modules at runtime and
  // the AWS SDK is a large package we don't want webpack rewriting.
  serverExternalPackages: ['tesseract.js', 'tesseract.js-core', '@aws-sdk/client-textract', 'sharp'],

  // Serverless bundles must ship the OCR engine + language data with the function.
  outputFileTracingIncludes: {
    '/api/extract': [
      './node_modules/tesseract.js/**/*',
      './node_modules/tesseract.js-core/**/*',
      './node_modules/@tesseract.js-data/**/*',
    ],
  },
}

export default nextConfig
