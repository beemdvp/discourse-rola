export const corsHeaders = () => {
  return {
    "Access-Control-Allow-Origin": `${process.env.ROLA_EXPECTED_ORIGIN}`,
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
};
