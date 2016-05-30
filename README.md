# homebridge-cec
libcec plugin for homebridge: https://github.com/nfarina/homebridge

# Installation

1. Install homebridge using: npm install -g homebridge
2. Install libcec https://github.com/Pulse-Eight/libcec.git (lookup how to install this for your platform)
3. Install node-cec https://github.com/adammw/node-cec.git (transmit branch)
3. Install this plugin using: npm install -g homebridge-cec
4. Update your configuration file. See the sample below.

# Configuration

Configuration sample:

 ```
"accessories": [
    {
        "accessory": "CEC",
        "name": "Television"
    }
]
```

