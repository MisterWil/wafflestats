# wafflestats

Live-updating graph dashboard for Wafflepool

## Getting Started

### Requirements

1. [NodeJS](http://nodejs.org/)
2. [Redis](http://redis.io/)
3. [MongoDB](http://www.mongodb.org/)

### Installation

1. After pulling, run 'npm install' on the root directory to install all node modules
2. Go to the ./configs directory and make a copy of default.json and change the values:
3. Change hashid to a unique, random string. This will be used for both redis sessions as well as generating the email notification hash.
4. Change your AWS secret keys and regions. For more information, see the [NodeJS AWS-SDK Website](http://aws.amazon.com/sdkfornodejs/).
5. Change your development/production redis and mongo connection information.
6. Run 'NODE_ENV=PRODUCTION CONFIG=./config/configName.json node wafflestats.js'

## Contributing

1. Fork!
2. Change!
3. Pull requests!