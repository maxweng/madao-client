var Web3 = require("web3");

(function() {
  // Planned for future features, logging, etc.
  function Provider(provider) {
    this.provider = provider;
  }

  Provider.prototype.send = function() {
    this.provider.send.apply(this.provider, arguments);
  };

  Provider.prototype.sendAsync = function() {
    this.provider.sendAsync.apply(this.provider, arguments);
  };

  var BigNumber = (new Web3()).toBigNumber(0).constructor;

  var Utils = {
    is_object: function(val) {
      return typeof val == "object" && !Array.isArray(val);
    },
    is_big_number: function(val) {
      if (typeof val != "object") return false;

      // Instanceof won't work because we have multiple versions of Web3.
      try {
        new BigNumber(val);
        return true;
      } catch (e) {
        return false;
      }
    },
    merge: function() {
      var merged = {};
      var args = Array.prototype.slice.call(arguments);

      for (var i = 0; i < args.length; i++) {
        var object = args[i];
        var keys = Object.keys(object);
        for (var j = 0; j < keys.length; j++) {
          var key = keys[j];
          var value = object[key];
          merged[key] = value;
        }
      }

      return merged;
    },
    promisifyFunction: function(fn, C) {
      var self = this;
      return function() {
        var instance = this;

        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {
          var callback = function(error, result) {
            if (error != null) {
              reject(error);
            } else {
              accept(result);
            }
          };
          args.push(tx_params, callback);
          fn.apply(instance.contract, args);
        });
      };
    },
    synchronizeFunction: function(fn, C) {
      var self = this;
      return function() {
        var args = Array.prototype.slice.call(arguments);
        var tx_params = {};
        var last_arg = args[args.length - 1];

        // It's only tx_params if it's an object and not a BigNumber.
        if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
          tx_params = args.pop();
        }

        tx_params = Utils.merge(C.class_defaults, tx_params);

        return new Promise(function(accept, reject) {

          var callback = function(error, tx) {
            if (error != null) {
              reject(error);
              return;
            }

            var timeout = C.synchronization_timeout || 240000;
            var start = new Date().getTime();

            var make_attempt = function() {
              C.web3.eth.getTransactionReceipt(tx, function(err, receipt) {
                if (err) return reject(err);

                if (receipt != null) {
                  return accept(tx, receipt);
                }

                if (timeout > 0 && new Date().getTime() - start > timeout) {
                  return reject(new Error("Transaction " + tx + " wasn't processed in " + (timeout / 1000) + " seconds!"));
                }

                setTimeout(make_attempt, 1000);
              });
            };

            make_attempt();
          };

          args.push(tx_params, callback);
          fn.apply(self, args);
        });
      };
    }
  };

  function instantiate(instance, contract) {
    instance.contract = contract;
    var constructor = instance.constructor;

    // Provision our functions.
    for (var i = 0; i < instance.abi.length; i++) {
      var item = instance.abi[i];
      if (item.type == "function") {
        if (item.constant == true) {
          instance[item.name] = Utils.promisifyFunction(contract[item.name], constructor);
        } else {
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], constructor);
        }

        instance[item.name].call = Utils.promisifyFunction(contract[item.name].call, constructor);
        instance[item.name].sendTransaction = Utils.promisifyFunction(contract[item.name].sendTransaction, constructor);
        instance[item.name].request = contract[item.name].request;
        instance[item.name].estimateGas = Utils.promisifyFunction(contract[item.name].estimateGas, constructor);
      }

      if (item.type == "event") {
        instance[item.name] = contract[item.name];
      }
    }

    instance.allEvents = contract.allEvents;
    instance.address = contract.address;
    instance.transactionHash = contract.transactionHash;
  };

  // Use inheritance to create a clone of this contract,
  // and copy over contract's static functions.
  function mutate(fn) {
    var temp = function Clone() { return fn.apply(this, arguments); };

    Object.keys(fn).forEach(function(key) {
      temp[key] = fn[key];
    });

    temp.prototype = Object.create(fn.prototype);
    bootstrap(temp);
    return temp;
  };

  function bootstrap(fn) {
    fn.web3 = new Web3();
    fn.class_defaults  = fn.prototype.defaults || {};

    // Set the network iniitally to make default data available and re-use code.
    // Then remove the saved network id so the network will be auto-detected on first use.
    fn.setNetwork("default");
    fn.network_id = null;
    return fn;
  };

  // Accepts a contract object created with web3.eth.contract.
  // Optionally, if called without `new`, accepts a network_id and will
  // create a new version of the contract abstraction with that network_id set.
  function Contract() {
    if (this instanceof Contract) {
      instantiate(this, arguments[0]);
    } else {
      var C = mutate(Contract);
      var network_id = arguments.length > 0 ? arguments[0] : "default";
      C.setNetwork(network_id);
      return C;
    }
  };

  Contract.currentProvider = null;

  Contract.setProvider = function(provider) {
    var wrapped = new Provider(provider);
    this.web3.setProvider(wrapped);
    this.currentProvider = provider;
  };

  Contract.new = function() {
    if (this.currentProvider == null) {
      throw new Error("MDC error: Please call setProvider() first before calling new().");
    }

    var args = Array.prototype.slice.call(arguments);

    if (!this.unlinked_binary) {
      throw new Error("MDC error: contract binary not set. Can't deploy new instance.");
    }

    var regex = /__[^_]+_+/g;
    var unlinked_libraries = this.binary.match(regex);

    if (unlinked_libraries != null) {
      unlinked_libraries = unlinked_libraries.map(function(name) {
        // Remove underscores
        return name.replace(/_/g, "");
      }).sort().filter(function(name, index, arr) {
        // Remove duplicates
        if (index + 1 >= arr.length) {
          return true;
        }

        return name != arr[index + 1];
      }).join(", ");

      throw new Error("MDC contains unresolved libraries. You must deploy and link the following libraries before you can deploy a new version of MDC: " + unlinked_libraries);
    }

    var self = this;

    return new Promise(function(accept, reject) {
      var contract_class = self.web3.eth.contract(self.abi);
      var tx_params = {};
      var last_arg = args[args.length - 1];

      // It's only tx_params if it's an object and not a BigNumber.
      if (Utils.is_object(last_arg) && !Utils.is_big_number(last_arg)) {
        tx_params = args.pop();
      }

      tx_params = Utils.merge(self.class_defaults, tx_params);

      if (tx_params.data == null) {
        tx_params.data = self.binary;
      }

      // web3 0.9.0 and above calls new twice this callback twice.
      // Why, I have no idea...
      var intermediary = function(err, web3_instance) {
        if (err != null) {
          reject(err);
          return;
        }

        if (err == null && web3_instance != null && web3_instance.address != null) {
          accept(new self(web3_instance));
        }
      };

      args.push(tx_params, intermediary);
      contract_class.new.apply(contract_class, args);
    });
  };

  Contract.at = function(address) {
    if (address == null || typeof address != "string" || address.length != 42) {
      throw new Error("Invalid address passed to MDC.at(): " + address);
    }

    var contract_class = this.web3.eth.contract(this.abi);
    var contract = contract_class.at(address);

    return new this(contract);
  };

  Contract.deployed = function() {
    if (!this.address) {
      throw new Error("Cannot find deployed address: MDC not deployed or address not set.");
    }

    return this.at(this.address);
  };

  Contract.defaults = function(class_defaults) {
    if (this.class_defaults == null) {
      this.class_defaults = {};
    }

    if (class_defaults == null) {
      class_defaults = {};
    }

    var self = this;
    Object.keys(class_defaults).forEach(function(key) {
      var value = class_defaults[key];
      self.class_defaults[key] = value;
    });

    return this.class_defaults;
  };

  Contract.extend = function() {
    var args = Array.prototype.slice.call(arguments);

    for (var i = 0; i < arguments.length; i++) {
      var object = arguments[i];
      var keys = Object.keys(object);
      for (var j = 0; j < keys.length; j++) {
        var key = keys[j];
        var value = object[key];
        this.prototype[key] = value;
      }
    }
  };

  Contract.all_networks = {
  "3": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "oracleItIdClaimId",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "bytes32"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "flightIds",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "recommender",
            "type": "address"
          },
          {
            "name": "_name",
            "type": "bytes32"
          },
          {
            "name": "_country",
            "type": "bytes32"
          },
          {
            "name": "_id",
            "type": "bytes32"
          },
          {
            "name": "_noncestr",
            "type": "bytes32"
          }
        ],
        "name": "signUp",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "balances",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimIds",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_flightNumber",
            "type": "bytes32"
          },
          {
            "name": "_departureTime",
            "type": "uint256"
          }
        ],
        "name": "addFlight",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "userAddress",
            "type": "address"
          }
        ],
        "name": "getFlightCount",
        "outputs": [
          {
            "name": "count",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_flightId",
            "type": "uint256"
          },
          {
            "name": "_name",
            "type": "bytes32"
          },
          {
            "name": "_country",
            "type": "bytes32"
          },
          {
            "name": "_id",
            "type": "bytes32"
          },
          {
            "name": "_noncestr",
            "type": "bytes32"
          }
        ],
        "name": "claim",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalClaims",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "flights",
        "outputs": [
          {
            "name": "flightNumber",
            "type": "bytes32"
          },
          {
            "name": "departureTime",
            "type": "uint256"
          },
          {
            "name": "queryNo",
            "type": "string"
          },
          {
            "name": "claimed",
            "type": "bool"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "uint256"
          },
          {
            "name": "result",
            "type": "string"
          }
        ],
        "name": "__callback",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claims",
        "outputs": [
          {
            "name": "claimer",
            "type": "address"
          },
          {
            "name": "claimerName",
            "type": "bytes32"
          },
          {
            "name": "claimerCountry",
            "type": "bytes32"
          },
          {
            "name": "claimerId",
            "type": "bytes32"
          },
          {
            "name": "claimerNoncestr",
            "type": "bytes32"
          },
          {
            "name": "flightNumber",
            "type": "bytes32"
          },
          {
            "name": "departureTime",
            "type": "uint256"
          },
          {
            "name": "oracleItId",
            "type": "uint256"
          },
          {
            "name": "status",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "infoHashes",
        "outputs": [
          {
            "name": "hash",
            "type": "bytes32"
          },
          {
            "name": "available",
            "type": "bool"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalUserAddresses",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalAvailableUserAddresses",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x6060604052611a59806100126000396000f3606060405236156100b95760e060020a600035046302851f9d81146100c15780630485ddf2146100d95780632005e8601461010857806327e235e3146101355780632821b37e1461014d5780632f1e92ce1461017257806336fbb298146101a55780633ff34632146101ca57806341c613831461020a578063471ce362146102135780634c4deecb14610260578063a888c2cd146102d4578063b59b3e3b14610329578063c707c5011461034b578063f0d7497914610354575b61035d610002565b61035f600435600c6020526000908152604090205481565b61035f600435602435604435600560209081526000938452604080852082529284528284209052825290205481565b61035d600435602435604435606435608435600080808681148061012b57508481145b156104a157610002565b61035f60043560026020526000908152604090205481565b600b6020908152600435600090815260408082209092526024358152205461035f9081565b61035d60043560243533600160a060020a031660009081526003602052604090206001015460ff16151561077457610002565b61035f600435600160a060020a0381166000908152600460205260409020545b919050565b61035d60043560243560443560643560843533600160a060020a03166000908152600360205260408120600101548190819060ff161515610bbb57610002565b61035f600a5481565b610371600435602435600460205260008281526040902080548290811015610002575060009081526020902060049190910201805460018201546003830154919350916002019060ff1684565b60408051602060248035600481810135601f810185900485028601850190965285855261035d9581359591946044949293909201918190840183828082843750949650505050505050600060006000600060006000610f5d60008054600160a060020a03168114156113c9576113c7610c5d565b6009602052600480356000908152604090208054600182015460028301546003840154948401546005850154600686015460078701546008979097015461041298600160a060020a0390971697959694959089565b6104646004356003602052600090815260409020805460019091015460ff1682565b61035f60075481565b61035f60085481565b005b60408051918252519081900360200190f35b604080518581526020810185905282151560608201526080918101828152845460026001821615610100026000190190911604928201839052909160a0830190859080156104005780601f106103d557610100808354040283529160200191610400565b820191906000526020600020905b8154815290600101906020018083116103e357829003601f168201915b50509550505050505060405180910390f35b60408051600160a060020a039a909a168a5260208a0198909852888801969096526060880194909452608087019290925260a086015260c085015260e084015261010083015251908190036101200190f35b6040805192835290151560208301528051918290030190f35b33600160a060020a03166000908152600260205260409020555b5050505050505050565b60009250600160a060020a03881683146104de5760646104da34600a5b600082820261117f848314806104d5575083858304145b6104ee565b0492505b6104fa34845b6000611186838311155b80151561149e57610002565b9150348383011461050a57610002565b6706f05b59d3b2000082101561051f57610002565b506040805187815260208181018890528183018790526060820186905282519182900360800190912033600160a060020a03166000908152600390925291812054141561063457600760008181505480929190600101919050555060086000818150548092919060010191905055503360066000506000600760005054815260200190815260200160002060006101000a815481600160a060020a030219169083021790555060406040519081016040528082815260200160018152602001506003600050600033600160a060020a031681526020019081526020016000206000506000820151816000016000505560208201518160010160006101000a81548160ff0219169083021790555090505061069b565b33600160a060020a0316600090815260036020526040902054811461065857610002565b33600160a060020a031660009081526003602052604090206001015460ff16151561069b5760406000206001908101805460ff1916821790556008805490910190555b600160a060020a0388166000148015906106b55750600083115b156106e557604051600160a060020a03891690600090859082818181858883f1935050505015156106e557610002565b33600160a060020a031660009081526002602052604090205461047d9083600082820161117f8482108015906104d55750838210156104ee565b505060609190910151600391909101805460ff191690911790555033600160a060020a0316600090815260046020908152604080832054600583528184208685528352818420858552909252909120555b5050565b620151809081900402428190111561078b57610002565b33600160a060020a03166000908152600560209081526040808320858452825280832084845290915281205411156107c257610002565b33600160a060020a03166000908152600460205260409020805460018101808355828183801582901161080e5760040281600402836000526020600020918201910161080e9190610912565b5050509190906000526020600020906004020160006080604051908101604052808681526020018581526020016109816109fb885b604080516020818101835260008083528351808301855281815284518084018652828152945193949093919283928392919080591061087f5750595b908082528060200260200182016040528015610896575b50945060009350600092505b602083101561118c576008830260020a87029150600160f860020a031982166000146108f457818585815181101561000257906020010190600160f860020a031916908160001a905350600193909301925b600192909201916108a2565b505060038101805460ff191690556004015b8082111561097d576000808255600182810182905560028381018054848255909281161561010002600019011604601f81901061094f5750610900565b601f01602090049060005260206000209081019061090091905b8082111561097d5760008155600101610969565b5090565b8152600060209182018190528251855582820151600186810191909155604084015180516002888101805481875295879020979998509693851615610100026000190190941693909304601f9081018590048301949190910190839010610b8b57805160ff19168380011785555b5061071f929150610969565b604080518082019091526001815260fd60020a6020820152610a4d610b868a6000816000141561121857507f30000000000000000000000000000000000000000000000000000000000000005b6101c5565b604080516020818101835260008083528351808301855281815284519283019094528152909161123e91869186918691905b60408051602081810183526000808352835180830185528190528351808301855281905283518083018552819052835180830185528190528351808301855281905283518083018552818152845192830185528183528551875189518b518d51985197988e988e988e988e988e989097929691958695019091019091010190805910610b085750595b908082528060200260200182016040528015610b1f575b50935083925060009150600090505b88518110156114a157888181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101610b2e565b610843565b828001600101855582156109ef579182015b828111156109ef578251826000505591602001919060010190610b9d565b8760001415610bc957610002565b6040805188815260208181018990528183018890526060820187905282519182900360800190912033600160a060020a0316600090815260039092529190205414610c1357610002565b33600160a060020a03166000908152600b602090815260408083208b84529091528120541115610c4257610002565b610caa60008054600160a060020a03168114156112b4576112b25b60008073878101bd3ee632b6d46005d98262d482a070f6313b1115611624575060008054600160a060020a03191673878101bd3ee632b6d46005d98262d482a070f63117905560016112af565b33600160a060020a031660009081526002602052604090205490935083901015610cd357610002565b33600160a060020a031660009081526004602052604090205488901015610cf957610002565b33600160a060020a0316600090815260046020526040902080546000198a0190811015610002579060005260206000209060040201600050600381015490925060ff1615610d4657610002565b60038201805460ff19166001908117909155604080516002858101805460209581161561010002600019011691909104601f8101859004850283018501909352828252610db79391929091830182828015610df25780601f10610dc757610100808354040283529160200191610df2565b90508060001415610e5157610002565b820191906000526020600020905b815481529060010190602001808311610dd557829003601f168201915b50505050508887600061123e6040604051908101604052806008815260200160c360020a67082d2e486e4c2e6d0281526020015061132d866040604051908101604052806001815260200160fd60020a81526020015061135388610843565b600a8054600190810180835560408051610120810182523380825260208281018e81528385018e8152606085018e8152608086018e81528c5460a088019081528d8b015460c0890190815260e089018e815260026101008b0181815260009d8e5260098a528c8e209b518c54600160a060020a031916178c5597519d8b019d909d5594519b89019b909b559151600388015551600487015551600586015596516006850155955160078401559451600892909201919091559354600160a060020a0385168352600b84528183208d84528452818320819055858352600c90935290205561049790845b600160a060020a03821660009081526002602052604090205461137990826104e4565b600160a060020a031633600160a060020a0316141515610f7c57610002565b6000888152600c60205260408120549650861115610497576000868152600960205260409020600881015490955060021415610497576110748760006114978260006040805160208101909152600090819052828180805b835181101561105657603060f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a031916108015906110415750603960f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a03191611155b156116d757811561173857856000141561172f575b600086111561106957600a86900a909202915b509095945050505050565b600114156110a2578454600160a060020a031660008181526002602052604090205494506110b29085610f3a565b6008858101555050505050505050565b60085460009011156111365760085469021e19e0c9bab24000000492506706f05b59d3b200008311156110eb576706f05b59d3b2000092505b600191505b60075482116111365750600081815260066020908152604080832054600160a060020a031680845260039092529091206001015460ff1615611167576111628184610f3a565b6040518554600160a060020a031690600090869082818181858883f19350505050151561117357610002565b928201925b600191909101906110f0565b60066008860155610497565b9392505050565b50900390565b8360405180591061119a5750595b9080825280602002602001820160405280156111b1575b506000935090505b8383101561120e57848381518110156100025790602001015160f860020a900460f860020a028184815181101561000257906020010190600160f860020a031916908160001a905350600192909201916111b9565b9695505050505050565b5b6000821115610a4857600a808304920660300160f860020a0261010090910417611219565b949350505050565b6040805160015460e060020a6331d98b3f02825260c360020a67082d2e486e4c2e6d0260048301529151600160a060020a0392909216916331d98b3f9160248181019260209290919082900301816000876161da5a03f115610002575050604051519091019150505b90565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f1156100025750506040515160018054600160a060020a031916909117905550611246620f42406404a817c8006104be565b620f42406404a817c80060008054600160a060020a031681141561162e5761162c610c5d565b604080518082019091526001815260fd60020a602082015261137489610843565b610a7f565b600160a060020a03831660009081526002602052604090208190556706f05b59d3b200009010156107705760036020526040600020600101805460ff19169055600880546000190190555050565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a031916909117908190557edf475e0000000000000000000000000000000000000000000000000000000082529151600160a060020a0392909216925062df475e91600482810192602092919082900301816000876161da5a03f1156100025750506040515191506112af9050565b90506101c5565b50565b5060005b87518110156114fd57878181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016114a5565b5060005b865181101561155957868181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101611501565b5060005b85518110156115b557858181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a90535060010161155d565b5060005b845181101561161157848181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016115b9565b50909d9c50505050505050505050505050565b5060006112af565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a03191690911790556020810190915260008082526116ce9250908790879087876000805481908190600160a060020a031681141561176a57611768610c5d565b95945050505050565b8381815181101561000257016020015160f860020a9081900402600160f860020a0319167f2e00000000000000000000000000000000000000000000000000000000000000141561172757600191505b600101610fd4565b60001995909501945b600a83029250825060308482815181101561000257016020015160f860020a908190048102040390920191611727565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f1156100025750506040515160018054600160a060020a031916909117905550600085141561183157600160009054906101000a9004600160a060020a0316600160a060020a03166395368d2e6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519550505b836000141561189157600160009054906101000a9004600160a060020a0316600160a060020a031663e7b4294c6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519450505b6040805160015460208b81015160e060020a6331d98b3f028452600484018190529351939550600160a060020a0391909116926331d98b3f92602481810193929182900301816000876161da5a03f11561000257505060405151915050670de0b6b3a764000081111561190f57600092505b50509695505050505050565b838502810190508050600160009054906101000a9004600160a060020a0316600160a060020a0316631d2c1b59828b858b8b8b8b6040518860e060020a028152600401808781526020018660001916815260200180602001806020018581526020018481526020018381038352878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156119cf5780820380516001836020036101000a031916815260200191505b508381038252868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015611a285780820380516001836020036101000a031916815260200191505b509850505050505050505060206040518083038185886185025a03f11561000257505060405151945061190391505056",
    "updated_at": 1482401510936,
    "links": {},
    "address": "0x380f3583ba17437ee1ff39d1092b04f437cb3a1e"
  },
  "default": {
    "abi": [
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "oracleItIdClaimId",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "bytes32"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "flightIds",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "recommender",
            "type": "address"
          },
          {
            "name": "_name",
            "type": "bytes32"
          },
          {
            "name": "_country",
            "type": "bytes32"
          },
          {
            "name": "_id",
            "type": "bytes32"
          },
          {
            "name": "_noncestr",
            "type": "bytes32"
          }
        ],
        "name": "signUp",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "balances",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claimIds",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_flightNumber",
            "type": "bytes32"
          },
          {
            "name": "_departureTime",
            "type": "uint256"
          }
        ],
        "name": "addFlight",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "userAddress",
            "type": "address"
          }
        ],
        "name": "getFlightCount",
        "outputs": [
          {
            "name": "count",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "_flightId",
            "type": "uint256"
          },
          {
            "name": "_name",
            "type": "bytes32"
          },
          {
            "name": "_country",
            "type": "bytes32"
          },
          {
            "name": "_id",
            "type": "bytes32"
          },
          {
            "name": "_noncestr",
            "type": "bytes32"
          }
        ],
        "name": "claim",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalClaims",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "flights",
        "outputs": [
          {
            "name": "flightNumber",
            "type": "bytes32"
          },
          {
            "name": "departureTime",
            "type": "uint256"
          },
          {
            "name": "queryNo",
            "type": "string"
          },
          {
            "name": "claimed",
            "type": "bool"
          }
        ],
        "type": "function"
      },
      {
        "constant": false,
        "inputs": [
          {
            "name": "id",
            "type": "uint256"
          },
          {
            "name": "result",
            "type": "string"
          }
        ],
        "name": "__callback",
        "outputs": [],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "claims",
        "outputs": [
          {
            "name": "claimer",
            "type": "address"
          },
          {
            "name": "claimerName",
            "type": "bytes32"
          },
          {
            "name": "claimerCountry",
            "type": "bytes32"
          },
          {
            "name": "claimerId",
            "type": "bytes32"
          },
          {
            "name": "claimerNoncestr",
            "type": "bytes32"
          },
          {
            "name": "flightNumber",
            "type": "bytes32"
          },
          {
            "name": "departureTime",
            "type": "uint256"
          },
          {
            "name": "oracleItId",
            "type": "uint256"
          },
          {
            "name": "status",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "name": "infoHashes",
        "outputs": [
          {
            "name": "hash",
            "type": "bytes32"
          },
          {
            "name": "available",
            "type": "bool"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalUserAddresses",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [],
        "name": "totalAvailableUserAddresses",
        "outputs": [
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "type": "function"
      },
      {
        "inputs": [],
        "type": "constructor"
      }
    ],
    "unlinked_binary": "0x6060604052611a59806100126000396000f3606060405236156100b95760e060020a600035046302851f9d81146100c15780630485ddf2146100d95780632005e8601461010857806327e235e3146101355780632821b37e1461014d5780632f1e92ce1461017257806336fbb298146101a55780633ff34632146101ca57806341c613831461020a578063471ce362146102135780634c4deecb14610260578063a888c2cd146102d4578063b59b3e3b14610329578063c707c5011461034b578063f0d7497914610354575b61035d610002565b61035f600435600c6020526000908152604090205481565b61035f600435602435604435600560209081526000938452604080852082529284528284209052825290205481565b61035d600435602435604435606435608435600080808681148061012b57508481145b156104a157610002565b61035f60043560026020526000908152604090205481565b600b6020908152600435600090815260408082209092526024358152205461035f9081565b61035d60043560243533600160a060020a031660009081526003602052604090206001015460ff16151561077457610002565b61035f600435600160a060020a0381166000908152600460205260409020545b919050565b61035d60043560243560443560643560843533600160a060020a03166000908152600360205260408120600101548190819060ff161515610bbb57610002565b61035f600a5481565b610371600435602435600460205260008281526040902080548290811015610002575060009081526020902060049190910201805460018201546003830154919350916002019060ff1684565b60408051602060248035600481810135601f810185900485028601850190965285855261035d9581359591946044949293909201918190840183828082843750949650505050505050600060006000600060006000610f5d60008054600160a060020a03168114156113c9576113c7610c5d565b6009602052600480356000908152604090208054600182015460028301546003840154948401546005850154600686015460078701546008979097015461041298600160a060020a0390971697959694959089565b6104646004356003602052600090815260409020805460019091015460ff1682565b61035f60075481565b61035f60085481565b005b60408051918252519081900360200190f35b604080518581526020810185905282151560608201526080918101828152845460026001821615610100026000190190911604928201839052909160a0830190859080156104005780601f106103d557610100808354040283529160200191610400565b820191906000526020600020905b8154815290600101906020018083116103e357829003601f168201915b50509550505050505060405180910390f35b60408051600160a060020a039a909a168a5260208a0198909852888801969096526060880194909452608087019290925260a086015260c085015260e084015261010083015251908190036101200190f35b6040805192835290151560208301528051918290030190f35b33600160a060020a03166000908152600260205260409020555b5050505050505050565b60009250600160a060020a03881683146104de5760646104da34600a5b600082820261117f848314806104d5575083858304145b6104ee565b0492505b6104fa34845b6000611186838311155b80151561149e57610002565b9150348383011461050a57610002565b6706f05b59d3b2000082101561051f57610002565b506040805187815260208181018890528183018790526060820186905282519182900360800190912033600160a060020a03166000908152600390925291812054141561063457600760008181505480929190600101919050555060086000818150548092919060010191905055503360066000506000600760005054815260200190815260200160002060006101000a815481600160a060020a030219169083021790555060406040519081016040528082815260200160018152602001506003600050600033600160a060020a031681526020019081526020016000206000506000820151816000016000505560208201518160010160006101000a81548160ff0219169083021790555090505061069b565b33600160a060020a0316600090815260036020526040902054811461065857610002565b33600160a060020a031660009081526003602052604090206001015460ff16151561069b5760406000206001908101805460ff1916821790556008805490910190555b600160a060020a0388166000148015906106b55750600083115b156106e557604051600160a060020a03891690600090859082818181858883f1935050505015156106e557610002565b33600160a060020a031660009081526002602052604090205461047d9083600082820161117f8482108015906104d55750838210156104ee565b505060609190910151600391909101805460ff191690911790555033600160a060020a0316600090815260046020908152604080832054600583528184208685528352818420858552909252909120555b5050565b620151809081900402428190111561078b57610002565b33600160a060020a03166000908152600560209081526040808320858452825280832084845290915281205411156107c257610002565b33600160a060020a03166000908152600460205260409020805460018101808355828183801582901161080e5760040281600402836000526020600020918201910161080e9190610912565b5050509190906000526020600020906004020160006080604051908101604052808681526020018581526020016109816109fb885b604080516020818101835260008083528351808301855281815284518084018652828152945193949093919283928392919080591061087f5750595b908082528060200260200182016040528015610896575b50945060009350600092505b602083101561118c576008830260020a87029150600160f860020a031982166000146108f457818585815181101561000257906020010190600160f860020a031916908160001a905350600193909301925b600192909201916108a2565b505060038101805460ff191690556004015b8082111561097d576000808255600182810182905560028381018054848255909281161561010002600019011604601f81901061094f5750610900565b601f01602090049060005260206000209081019061090091905b8082111561097d5760008155600101610969565b5090565b8152600060209182018190528251855582820151600186810191909155604084015180516002888101805481875295879020979998509693851615610100026000190190941693909304601f9081018590048301949190910190839010610b8b57805160ff19168380011785555b5061071f929150610969565b604080518082019091526001815260fd60020a6020820152610a4d610b868a6000816000141561121857507f30000000000000000000000000000000000000000000000000000000000000005b6101c5565b604080516020818101835260008083528351808301855281815284519283019094528152909161123e91869186918691905b60408051602081810183526000808352835180830185528190528351808301855281905283518083018552819052835180830185528190528351808301855281905283518083018552818152845192830185528183528551875189518b518d51985197988e988e988e988e988e989097929691958695019091019091010190805910610b085750595b908082528060200260200182016040528015610b1f575b50935083925060009150600090505b88518110156114a157888181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101610b2e565b610843565b828001600101855582156109ef579182015b828111156109ef578251826000505591602001919060010190610b9d565b8760001415610bc957610002565b6040805188815260208181018990528183018890526060820187905282519182900360800190912033600160a060020a0316600090815260039092529190205414610c1357610002565b33600160a060020a03166000908152600b602090815260408083208b84529091528120541115610c4257610002565b610caa60008054600160a060020a03168114156112b4576112b25b60008073878101bd3ee632b6d46005d98262d482a070f6313b1115611624575060008054600160a060020a03191673878101bd3ee632b6d46005d98262d482a070f63117905560016112af565b33600160a060020a031660009081526002602052604090205490935083901015610cd357610002565b33600160a060020a031660009081526004602052604090205488901015610cf957610002565b33600160a060020a0316600090815260046020526040902080546000198a0190811015610002579060005260206000209060040201600050600381015490925060ff1615610d4657610002565b60038201805460ff19166001908117909155604080516002858101805460209581161561010002600019011691909104601f8101859004850283018501909352828252610db79391929091830182828015610df25780601f10610dc757610100808354040283529160200191610df2565b90508060001415610e5157610002565b820191906000526020600020905b815481529060010190602001808311610dd557829003601f168201915b50505050508887600061123e6040604051908101604052806008815260200160c360020a67082d2e486e4c2e6d0281526020015061132d866040604051908101604052806001815260200160fd60020a81526020015061135388610843565b600a8054600190810180835560408051610120810182523380825260208281018e81528385018e8152606085018e8152608086018e81528c5460a088019081528d8b015460c0890190815260e089018e815260026101008b0181815260009d8e5260098a528c8e209b518c54600160a060020a031916178c5597519d8b019d909d5594519b89019b909b559151600388015551600487015551600586015596516006850155955160078401559451600892909201919091559354600160a060020a0385168352600b84528183208d84528452818320819055858352600c90935290205561049790845b600160a060020a03821660009081526002602052604090205461137990826104e4565b600160a060020a031633600160a060020a0316141515610f7c57610002565b6000888152600c60205260408120549650861115610497576000868152600960205260409020600881015490955060021415610497576110748760006114978260006040805160208101909152600090819052828180805b835181101561105657603060f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a031916108015906110415750603960f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a03191611155b156116d757811561173857856000141561172f575b600086111561106957600a86900a909202915b509095945050505050565b600114156110a2578454600160a060020a031660008181526002602052604090205494506110b29085610f3a565b6008858101555050505050505050565b60085460009011156111365760085469021e19e0c9bab24000000492506706f05b59d3b200008311156110eb576706f05b59d3b2000092505b600191505b60075482116111365750600081815260066020908152604080832054600160a060020a031680845260039092529091206001015460ff1615611167576111628184610f3a565b6040518554600160a060020a031690600090869082818181858883f19350505050151561117357610002565b928201925b600191909101906110f0565b60066008860155610497565b9392505050565b50900390565b8360405180591061119a5750595b9080825280602002602001820160405280156111b1575b506000935090505b8383101561120e57848381518110156100025790602001015160f860020a900460f860020a028184815181101561000257906020010190600160f860020a031916908160001a905350600192909201916111b9565b9695505050505050565b5b6000821115610a4857600a808304920660300160f860020a0261010090910417611219565b949350505050565b6040805160015460e060020a6331d98b3f02825260c360020a67082d2e486e4c2e6d0260048301529151600160a060020a0392909216916331d98b3f9160248181019260209290919082900301816000876161da5a03f115610002575050604051519091019150505b90565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f1156100025750506040515160018054600160a060020a031916909117905550611246620f42406404a817c8006104be565b620f42406404a817c80060008054600160a060020a031681141561162e5761162c610c5d565b604080518082019091526001815260fd60020a602082015261137489610843565b610a7f565b600160a060020a03831660009081526002602052604090208190556706f05b59d3b200009010156107705760036020526040600020600101805460ff19169055600880546000190190555050565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a031916909117908190557edf475e0000000000000000000000000000000000000000000000000000000082529151600160a060020a0392909216925062df475e91600482810192602092919082900301816000876161da5a03f1156100025750506040515191506112af9050565b90506101c5565b50565b5060005b87518110156114fd57878181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016114a5565b5060005b865181101561155957868181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101611501565b5060005b85518110156115b557858181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a90535060010161155d565b5060005b845181101561161157848181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016115b9565b50909d9c50505050505050505050505050565b5060006112af565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a03191690911790556020810190915260008082526116ce9250908790879087876000805481908190600160a060020a031681141561176a57611768610c5d565b95945050505050565b8381815181101561000257016020015160f860020a9081900402600160f860020a0319167f2e00000000000000000000000000000000000000000000000000000000000000141561172757600191505b600101610fd4565b60001995909501945b600a83029250825060308482815181101561000257016020015160f860020a908190048102040390920191611727565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f1156100025750506040515160018054600160a060020a031916909117905550600085141561183157600160009054906101000a9004600160a060020a0316600160a060020a03166395368d2e6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519550505b836000141561189157600160009054906101000a9004600160a060020a0316600160a060020a031663e7b4294c6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519450505b6040805160015460208b81015160e060020a6331d98b3f028452600484018190529351939550600160a060020a0391909116926331d98b3f92602481810193929182900301816000876161da5a03f11561000257505060405151915050670de0b6b3a764000081111561190f57600092505b50509695505050505050565b838502810190508050600160009054906101000a9004600160a060020a0316600160a060020a0316631d2c1b59828b858b8b8b8b6040518860e060020a028152600401808781526020018660001916815260200180602001806020018581526020018481526020018381038352878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156119cf5780820380516001836020036101000a031916815260200191505b508381038252868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015611a285780820380516001836020036101000a031916815260200191505b509850505050505050505060206040518083038185886185025a03f11561000257505060405151945061190391505056",
    "updated_at": 1482401416478
  }
};

  Contract.checkNetwork = function(callback) {
    var self = this;

    if (this.network_id != null) {
      return callback();
    }

    this.web3.version.network(function(err, result) {
      if (err) return callback(err);

      var network_id = result.toString();

      // If we have the main network,
      if (network_id == "1") {
        var possible_ids = ["1", "live", "default"];

        for (var i = 0; i < possible_ids.length; i++) {
          var id = possible_ids[i];
          if (Contract.all_networks[id] != null) {
            network_id = id;
            break;
          }
        }
      }

      if (self.all_networks[network_id] == null) {
        return callback(new Error(self.name + " error: Can't find artifacts for network id '" + network_id + "'"));
      }

      self.setNetwork(network_id);
      callback();
    })
  };

  Contract.setNetwork = function(network_id) {
    var network = this.all_networks[network_id] || {};

    this.abi             = this.prototype.abi             = network.abi;
    this.unlinked_binary = this.prototype.unlinked_binary = network.unlinked_binary;
    this.address         = this.prototype.address         = network.address;
    this.updated_at      = this.prototype.updated_at      = network.updated_at;
    this.links           = this.prototype.links           = network.links || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "object") {
      Object.keys(name).forEach(function(n) {
        var a = name[n];
        Contract.link(n, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "MDC";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.1.2";

  var properties = {
    binary: function() {
      var binary = Contract.unlinked_binary;

      Object.keys(Contract.links).forEach(function(library_name) {
        var library_address = Contract.links[library_name];
        var regex = new RegExp("__" + library_name + "_*", "g");

        binary = binary.replace(regex, library_address.replace("0x", ""));
      });

      return binary;
    }
  };

  Object.keys(properties).forEach(function(key) {
    var getter = properties[key];

    var definition = {};
    definition.enumerable = true;
    definition.configurable = false;
    definition.get = getter;

    Object.defineProperty(Contract, key, definition);
    Object.defineProperty(Contract.prototype, key, definition);
  });

  bootstrap(Contract);

  if (typeof module != "undefined" && typeof module.exports != "undefined") {
    module.exports = Contract;
  } else {
    // There will only be one version of this contract in the browser,
    // and we can use that.
    window.MDC = Contract;
  }
})();
