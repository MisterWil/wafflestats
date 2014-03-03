# wafflestats

Live-updating graph dashboard for Wafflepool

## Getting Started

### Requirements

1. [NodeJS](http://nodejs.org/)
1. [Redis](http://redis.io/)
1. [MongoDB](http://www.mongodb.org/)

### Installation

1. After installing all requirements, go to the Wafflestats directory
1. Create a file named `aws.json`. For better understanding of AWS configuration on NodeJS, check the [NodeJS AWS-SDK Website](http://aws.amazon.com/sdkfornodejs/)
1. Run the command `npm install`
1. Run `HASHID=xxx node wafflestats.js`

Note: The `HASHID` environment variable will be used as your Redis secret and the generation of Wafflestats email notifications secrets.

## Contributing

1. Fork it
1. Implement
1. Pull request