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
        
        this.log = log;
        
        this.adapters = cec.detectAdapters();
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
        
        //if(that.serialPort.isOpen()) that.serialPort.close();
        cec.open(that.adapters[0].portName, function (error, adapter) {
            if ( error ) {
                that.log('failed to open: '+error);
            } else {
                console.log('open and write command ' + command);
                 
                adapter.transmit({
                                  initiator: CEC.LogicalAddress.TUNER1,
                                  destination: CEC.LogicalAddress.TV
                                  });
                adapter.on('logmessage', function(data) {
                            that.log(data.message);
                            });
                 
                 if(command == 'on') {
                    adapter.powerOn();
                    callback(0,0);
                 }
                 else if(command == 'off') {
                    adapter.standby();
                    callback(0,0);
                 }
            }
        });
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
/* TODO
    getPowerState: function(callback) {
        var cmd = "@PWR:?\r";
        
        this.exec(cmd, function(response,error) {
                         
                         if (response && response.indexOf("@PWR:2") > -1) {
                         callback(null, true);
                         }
                         else {
                         callback(null, false);
                         }
                         this.log("Power state is:", response);
                         
                         }.bind(this))
        
    },
*/
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
                         this.log('Serial power function failed: %s');
                         callback(error);
                         }
                         else {
                         this.log('Serial power function succeeded!');
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
        
        var switchService = new Service.Switch("Power State");
        switchService
        .getCharacteristic(Characteristic.On)
//        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));

        return [informationService, switchService];
    }
    }
}