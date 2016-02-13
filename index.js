// Accessory for controlling Marantz AVR via HomeKit

var inherits = require('util').inherits;
var CEC = require("cec");
var cec = new CEC();
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
        
        this.adapters = cec.detectAdapters();
        this.log('CEC adapters: %j', this.adapters);
        
        this.adapter = 0;
        
        var o = cec.open(this.adapters[0].portName, function (error, adapter) {
            var that = this;
            if ( error ) {
                 this.log('failed to open: '+error);
            } else {
                this.adapter = adapter;
                 adapter.on('logmessage', function(data) {
                    this.log.debug(data.message);
                 }.bind(this));
                 adapter.on('command', function(data) {
                    this.log("command: initiator=" + data.initiator + " destination=" + data.destination + " opcode=" + data.opcode);
                            
                    if (this.switchService) {
                        var charOn = this.switchService.getCharacteristic(Characteristic.On);
                        if(charOn) {
                            if(data.opcode == 54) charOn.setValue(0);     // CEC_OPCODE_STANDBY
                            else if(data.opcode == 9) charOn.setValue(1); // CEC_OPCODE_RECORD_ON
                        }
                    }
                 }.bind(this));
            }
        }.bind(this));
    }
    
    LibCEC.prototype = {
        
    send: function(cmd, callback) {
        this.sendCommand(cmd, callback);
        //if (callback) callback();
    },
        
    exec: function() {
        // Check if the queue has a reasonable size
        if(this.queue.length > 5) this.queue.clear();
            
        this.queue.push(arguments);
        this.process();
    },
        
    sendCommand: function(command, callback) {
        var that = this;
        if(this.adapter) {
            var response = 0;
            if(command == 'on') this.adapter.powerOn();
            else if(command == 'off') this.adapter.standby();
            else if(command == 'isOn') response = this.adapter.getPowerState();
            else if(command.indexOf('hdmi')>-1) {
                var port = parseInt(command.substr(command.indexOf('hdmi')+4));
                this.hdmiPort = port;
                response = this.adapter.setHDMIPort(port);
            }
            callback(response,0);
        } else {
            callback(1,1);
        }
    },
        
    process: function() {
        if (this.queue.length === 0) return;
        if (!this.ready) return;
        var self = this;
        this.ready = false;
        this.send.apply(this, this.queue.shift());
        setTimeout(function () {
                    self.ready = true;
                    self.process();
                    }, this.timeout);
    },

    getPowerState: function(callback) {
        var cmd = 'isOn';
        
        this.exec(cmd, function(response,error) {
                  if (error) {
                    this.log('CEC power function failed: %s');
                    callback(error);
                  }
                  else {
                    if (response) {
                        callback(null, true);
                    }
                    else {
                        callback(null, false);
                    }
                    this.log("Power state is:", response);
                  }
              }.bind(this))
        
    },

    setPowerState: function(powerOn, callback) {
        var cmd;
        
        if (powerOn) {
            cmd = 'on';
            this.log("Set", this.name, "to on");
        }
        else {
            cmd = 'off';
            this.log("Set", this.name, "to off");
        }
        
        this.exec(cmd, function(response,error) {
                         if (error) {
                         this.log('CEC power function failed: %s');
                         callback(error);
                         }
                         else {
                         this.log('CEC power function succeeded!');
                         if(callback) callback();
                         }
                         }.bind(this));
    },
        
    getHDMIPort: function(callback) {
        // Not implemented yet
        callback(null,this.hdmiPort);
    },
        
    setHDMIPort: function(port, callback) {
        var cmd = 'hdmi' + port;
        
        this.setPowerState('on');
        
        this.log("Set", this.name, "hdmi port to " + port);
        
        this.exec(cmd, function(response,error) {
            if (error) {
                this.log('CEC setHDMI function failed: %s');
                callback(error);
            }
            else {
                this.log('CEC setHDMI function succeeded!');
                callback();
            }
        }.bind(this));
    },

    getServices: function() {
        var that = this;
        
        var informationService = new Service.AccessoryInformation();
        informationService
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.Manufacturer, "Toshiba")
        .setCharacteristic(Characteristic.Model, "Z3030")
        .setCharacteristic(Characteristic.SerialNumber, "1244567890");
        
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
        
        return [informationService, this.switchService];
    }
    }
};

function makeHDMICharacteristic() {
    
    HDMICharacteristic = function () {
        Characteristic.call(this, 'HDMI', '212131F4-2E14-4FF4-AE13-C97C3232499D');
        this.setProps({
                      format: Characteristic.Formats.INT,
                      unit: Characteristic.Units.NONE,
                      maxValue: 4,
                      minValue: 1,
                      minStep: 1,
                      perms: [Characteristic.Perms.READ, Characteristic.Perms.WRITE, Characteristic.Perms.NOTIFY]
                      });
        this.value = this.getDefaultValue();
    };
    
    inherits(HDMICharacteristic, Characteristic);
}