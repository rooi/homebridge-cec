// Accessory for controlling Marantz AVR via HomeKit

var inherits = require('util').inherits;
var nodecec = require("node-cec");
var NodeCec = nodecec.NodeCec;
//var cec = new NodeCec( 'node-cec-monitor' );
var CEC     = nodecec.CEC;
var Service, Characteristic;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    
    homebridge.registerAccessory("homebridge-cec", "CEC", LibCEC);
    
    function LibCEC(log, config) {
        // configuration
        this.name = config['name'];
        
        this.timeout = config.timeout || 1000;
        this.queue = [];
        this.ready = true;
        
        this.hdmiPort = 1;
        
        this.log = log;
        
        this.isOn = true; // TV is turned on at start
    }
    
    LibCEC.prototype = {
        
    getPowerState: function(callback) {
        this.log("Power state is: ", this.isOn);
        if(callback) callback(null, this.isOn);
    },
        
    setPowerState: function(powerOn, callback) {
        this.isOn = powerOn;
        if(this.client) {
            if(this.isOn) {
                this.client.sendCommand( 0xf0, CEC.Opcode.IMAGE_VIEW_ON  );
            }
            else {
                this.client.sendCommand( 0xf0, CEC.Opcode.STANDBY );
            }
            if(callback) callback();
        }
        else {
            if(callback) callback("no client");
        }
    },

    getHDMIPort: function(callback) {
        // Not implemented yet
        callback(null,this.hdmiPort);
    },
        
    setHDMIPort: function(port, callback) {
        this.hdmiPort = port;
        
        if(this.client) this.client.sendCommand( 0x1f, CEC.Opcode.ACTIVE_SOURCE, port*16, 0x00);

        if(callback) callback();
    },
        
    getServices: function() {
        var that = this;
        
        this.cec = new NodeCec( 'node-cec-monitor' );
        
        var informationService = new Service.AccessoryInformation();
        informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "Toshiba")
        .setCharacteristic(Characteristic.Model, "homebridge")
        .setCharacteristic(Characteristic.SerialNumber, "1244567890");
        
        this.informationService = informationService; // Store to allow changing at runtime
        
        this.switchService = new Service.Switch("Power State");
        this.switchService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
        
        makeHDMICharacteristic();
        
        this.switchService
        .addCharacteristic(HDMICharacteristic)
        .on('get', this.getHDMIPort.bind(this))
        .on('set', this.setHDMIPort.bind(this));
        
        // Get Vendor ID
        this.cec.once( 'ready', function(client) {
            this.log( ' -- GIVE_DEVICE_VENDOR_ID -- ' );
            this.client = client; // Store the client for later usage
            client.sendCommand( 0xf0, CEC.Opcode.GIVE_DEVICE_VENDOR_ID, 0x0F, 0x8C );
            client.sendCommand( 0xf0, CEC.Opcode.IMAGE_VIEW_ON ); // This works (on)
            this.cec.once( 'DEVICE_VENDOR_ID', function (packet, id, vendor) {
                this.log('DEVICE_VENDOR_ID:' + packet + ", " + id + ", " + vendor);
                this.informationService.getCharacteristic(Characteristic.Manufacturer).setValue(vendor);
            }.bind(this));
        }.bind(this));
        
        this.cec.on( 'ROUTING_CHANGE', function(packet, fromSource, toSource) {
            this.log( 'Routing changed from ' + fromSource + ' to ' + toSource + '.' );
            if(toSource == 0) {
               this.isOn = false;
               this.hdmiPort = 0;
               this.switchService.getCharacteristic(Characteristic.On).setValue(this.isOn);
               this.switchService.getCharacteristic(HDMICharacteristic).setValue(this.hdmiPort);
            }
            else if( fromSource == 0 ){
               this.isOn = true;
               this.hdmiPort = toSource/4096;
               this.switchService.getCharacteristic(Characteristic.On).setValue(this.isOn);
               this.switchService.getCharacteristic(HDMICharacteristic).setValue(this.hdmiPort);
            }
        }.bind(this));
        
        this.cec.on( 'STANDBY', function() {
            this.log( 'STANDBY' );
            this.isOn = false;
            this.switchService.getCharacteristic(Characteristic.On).setValue(this.isOn);
        }.bind(this));
        
        // -------------------------------------------------------------------------- //
        //- KILL CEC-CLIENT PROCESS ON EXIT
        
        process.on( 'SIGINT', function() {
            console.log("Killing CEC");
            if ( this.cec != null ) {
                this.cec.stop();
            }
            process.exit();
        });
        
        
        // -------------------------------------------------------------------------- //
        //- START CEC CLIENT
        
        // -m  = start in monitor-mode
        // -d8 = set log level to 8 (=TRAFFIC) (-d 8)
        // -br = logical address set to `recording device`
        this.log("Starting cec-client");
        this.cec.start( 'cec-client', '-m', '-d', '8', '-b', 'r' );

        
        return [informationService, this.switchService];
    }
    };
};

function makeHDMICharacteristic() {
    
    HDMICharacteristic = function () {
        Characteristic.call(this, 'HDMI', '212131F4-2E14-4FF4-AE13-C97C3232499D');
        this.setProps({
            format: Characteristic.Formats.INT,
            unit: Characteristic.Units.NONE,
            maxValue: 3,
            minValue: 1,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    
    inherits(HDMICharacteristic, Characteristic);
}
