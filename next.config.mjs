/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        outputFileTracingIncludes: {
            // Include all files in the 'data' directory
            './data/**/*': ['./data/**/*'],
        },
    },
};

export default nextConfig;
