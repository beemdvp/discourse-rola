# Discourse ROLA

Discourse ROLA is a Docker-based application that exposes a REST API integrating Discourse and Radix ROLA standards. This application is built using TypeScript and leverages Bun as the JavaScript runtime for fast performance.

For use with [Discourse Radix Connect Plugin](https://github.com/beemdvp/discourse-radix-connect-plugin)

## Features

- **REST API**: Provides endpoints to interact with the application.
- **Discourse Integration**: Seamlessly integrates with Discourse for community discussions.
- **Radix ROLA Standards**: Implements Radix ROLA standards for secure and efficient operations.
- **Dockerized**: Easily deployable using Docker containers.

## API Endpoints

### `POST /create-challenge`

This endpoint generates a new challenge for the client. It is used as part of the authentication process to ensure secure communication between the client and the server.

- **Response**: Returns a JSON object containing the generated challenge.

### `POST /verify`

This endpoint verifies the signed challenge provided by the client. It checks the validity of the challenge and authenticates the user based on the provided proofs and persona data.

- **Request Body**: Expects a JSON object containing:
  - `proofs`: An array of signed challenges.
  - `personaData`: An array of persona data fields.
  - `persona`: An object of identity address and label which is used as the username
  - `migrationAuth`: An optional object used to determine whether the use is trying to migrate their user to use Radix connect to handle their passwords

- **Response**: Returns a JSON object indicating whether the verification was successful and includes user credentials if valid.

## Prerequisites

- Docker installed on your machine.
- Bun v1.1.3 or later.

#### Environment Variables

The following environment variables are required to run the container:

- **DISCOURSE_API_URL**: The URL of the Discourse API.
- **DISCOURSE_USERNAME**: The username for Discourse API authentication.
- **DISCOURSE_API_KEY**: The API key for Discourse API authentication.
- **DATABASE_URL**: The URL for connecting to the PostgreSQL database.
- **DAPP_DEFINITION_ADDRESS**: The address of the dApp definition.
- **ROLA_EXPECTED_ORIGIN**: The expected origin of the client making the wallet request.
- **APPLICATION_NAME**: The name of the application.
- **APPLICATION_VERSION**: The version of the application.
- **NETWORK_ID**: The network ID of the Radix network.
- **SECRET_KEY**: This is used to encrypt passwords generated

```
docker run -d \
  -e DISCOURSE_API_URL='your_discourse_api_url' \
  -e DISCOURSE_USERNAME='your_discourse_username' \
  -e DISCOURSE_API_KEY='your_discourse_api_key' \
  -e DATABASE_URL='your_database_url' \
  -e DAPP_DEFINITION_ADDRESS='your_dapp_definition_address' \
  -e ROLA_EXPECTED_ORIGIN='your_rola_expected_origin' \
  -e APPLICATION_NAME='your_application_name' \
  -e APPLICATION_VERSION='your_application_version' \
  -e NETWORK_ID='1'\ # 1 for mainnet, 2 for stokenet
  -e SECRET_KEY='foobar'
  -p 4000:4000 \
  beemdvpp/discourse-rola
```
