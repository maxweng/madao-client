var Web3 = require("web3");
var SolidityEvent = require("web3/lib/web3/event.js");

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
    synchronizeFunction: function(fn, instance, C) {
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

          var decodeLogs = function(logs) {
            return logs.map(function(log) {
              var logABI = C.events[log.topics[0]];

              if (logABI == null) {
                return null;
              }

              var decoder = new SolidityEvent(null, logABI, instance.address);
              return decoder.decode(log);
            }).filter(function(log) {
              return log != null;
            });
          };

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
                  // If they've opted into next gen, return more information.
                  if (C.next_gen == true) {
                    return accept({
                      tx: tx,
                      receipt: receipt,
                      logs: decodeLogs(receipt.logs)
                    });
                  } else {
                    return accept(tx);
                  }
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
          instance[item.name] = Utils.synchronizeFunction(contract[item.name], instance, constructor);
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
            "name": "_flightNumber",
            "type": "bytes32"
          },
          {
            "name": "_departureTime",
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
        "name": "userAddresses",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "x",
            "type": "bytes32"
          }
        ],
        "name": "bytes32ToString",
        "outputs": [
          {
            "name": "",
            "type": "string"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "v",
            "type": "uint256"
          }
        ],
        "name": "uintToBytes",
        "outputs": [
          {
            "name": "ret",
            "type": "bytes32"
          }
        ],
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
            "type": "uint8"
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
        "constant": false,
        "inputs": [
          {
            "name": "source",
            "type": "string"
          }
        ],
        "name": "stringToBytes32",
        "outputs": [
          {
            "name": "result",
            "type": "bytes32"
          }
        ],
        "type": "function"
      },
      {
        "constant": true,
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "idClaimIds",
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
    "unlinked_binary": "0x6060604052611ca0806100126000396000f3606060405236156100da5760e060020a600035046302851f9d81146100e25780632005e860146100fa57806327e235e3146101275780632f1e92ce1461013f57806336fbb298146101785780633ffd504b1461019d57806341c61383146101f4578063471ce362146101fd5780634c4deecb1461024a578063502c9bd5146102be5780639201de55146102df57806394e8767d146103a3578063a888c2cd146103dd578063b59b3e3b14610439578063c707c5011461045b578063cfb5192814610464578063e23b927a146104b6578063f0d74979146104eb575b6104f4610002565b6104f6600435600b6020526000908152604090205481565b6104f4600435602435604435606435608435600080808681148061011d57508481145b156106ca57610002565b6104f660043560026020526000908152604090205481565b6104f460043560243533600160a060020a031660009081526003602052604081206001015481908190819060ff1615156108d657610002565b6104f6600435600160a060020a0381166000908152600460205260409020545b919050565b6104f460043560243560443560643560843560a4356040805160208181018352600080835233600160a060020a0316815260039091529182206001015482918291829182918290819060ff161515610cbd57610002565b6104f660095481565b610508600435602435600460205260008281526040902080548290811015610002575060009081526020902060049190910201805460018201546003830154919350916002019060ff1684565b60408051602060248035600481810135601f81018590048502860185019096528585526104f495813595919460449492939092019181908401838280828437509496505050505050506000600060006000600060006111f160008054600160a060020a031681141561160c5761160a610dbd565b6105a9600435600560205260009081526040902054600160a060020a031681565b6105c56004355b60408051602081810183526000808352835180830185528181528451808401865282815294519394909391928392839291908059106103225750595b908082528060200260200182016040528015610339575b50945060009350600092505b6020831015611429576008830260020a87029150600160f860020a0319821660001461039757818585815181101561000257906020010190600160f860020a031916908160001a905350600193909301925b60019290920191610345565b6104f66004355b600081600014156114b557507f30000000000000000000000000000000000000000000000000000000000000005b610198565b6008602081905260048035600090815260409020805460018201546002830154600384015494840154600585015460068601546007870154989096015461063398600160a060020a039096169794969395929391929060ff1689565b6106886004356003602052600090815260409020805460019091015460ff1682565b6104f660065481565b6104f66004808035906020019082018035906020019191908080601f016020809104026020016040519081016040528093929190818152602001838380828437509496505050505050505b6020015190565b6104f6600435602435600a60205260008281526040902080548290811015610002576000918252602090912001549150829050565b6104f660075481565b005b60408051918252519081900360200190f35b604080518581526020810185905282151560608201526080918101828152845460026001821615610100026000190190911604928201839052909160a0830190859080156105975780601f1061056c57610100808354040283529160200191610597565b820191906000526020600020905b81548152906001019060200180831161057a57829003601f168201915b50509550505050505060405180910390f35b60408051600160a060020a039092168252519081900360200190f35b60405180806020018281038252838181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f1680156106255780820380516001836020036101000a031916815260200191505b509250505060405180910390f35b60408051600160a060020a039a909a168a5260208a0198909852888801969096526060880194909452608087019290925260a086015260c085015260e084015260ff1661010083015251908190036101200190f35b6040805192835290151560208301528051918290030190f35b33600160a060020a031660009081526002602052604090208054830190555b5050505050505050565b60009250600160a060020a03881683146106e857606434600a020492505b348381039250828401146106fb57610002565b6706f05b59d3b2000082101561071057610002565b506040805187815260208181018890528183018790526060820186905282519182900360800190912033600160a060020a03166000908152600390925291812054141561082557600660008181505480929190600101919050555060076000818150548092919060010191905055503360056000506000600660005054815260200190815260200160002060006101000a815481600160a060020a030219169083021790555060406040519081016040528082815260200160018152602001506003600050600033600160a060020a031681526020019081526020016000206000506000820151816000016000505560208201518160010160006101000a81548160ff0219169083021790555090505061088c565b33600160a060020a0316600090815260036020526040902054811461084957610002565b33600160a060020a031660009081526003602052604090206001015460ff16151561088c5760406000206001908101805460ff1916821790556007805490910190555b600160a060020a0388166000148015906108a65750600083115b156106a157604051600160a060020a03891690600090859082818181858883f1935050505015156106a157610002565b844211156108e357610002565b33600160a060020a0316600090815260046020526040812054945092508291505b8382101561097c5733600160a060020a031660009081526004602052604090208054839081101561000257906000526020600020906004020160005080549091508614801561095d57506001810154611c1f1986019010155b801561097257506001810154611c2086019011155b156109c857610002565b33600160a060020a0316600090815260046020526040902080546001810180835582818380158290116109d4576004028160040283600052602060002091820191016109d49190610a1f565b60019190910190610904565b5050509190906000526020600020906004020160006080604051908101604052808a8152602001898152602001610a8e610b088c6102e6565b505060038101805460ff191690556004015b80821115610a8a576000808255600182810182905560028381018054848255909281161561010002600019011604601f819010610a5c5750610a0d565b601f016020900490600052602060002090810190610a0d91905b80821115610a8a5760008155600101610a76565b5090565b8152600060209182018190528251855582820151600186810191909155604084015180516002888101805481875295879020979998509693851615610100026000190190941693909304601f9081018590048301949190910190839010610c6a57805160ff19168380011785555b50610c9a929150610a76565b604080518082019091526001815260fd60020a6020820152610b2c610c658e6103aa565b60408051602081810183526000808352835180830185528181528451928301909452815290916114db91869186918691905b60408051602081810183526000808352835180830185528190528351808301855281905283518083018552819052835180830185528190528351808301855281905283518083018552818152845192830185528183528551875189518b518d51985197988e988e988e988e988e989097929691958695019091019091010190805910610be75750595b908082528060200260200182016040528015610bfe575b50935083925060009150600090505b88518110156116e157888181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101610c0d565b6102e6565b82800160010185558215610afc579182015b82811115610afc578251826000505591602001919060010190610c7c565b505060609190910151600391909101805460ff1916909117905550505050505050565b604080518d815260208181018e90528183018d9052606082018c905282519182900360800190912033600160a060020a0316600090815260039092529190205414610d0757610002565b60008a8152600a602052604081205490985096505b86881015610da25760008a8152600a60205260408120805460089291908b90811015610002579060005260206000209001600050548152602081019190915260400160002060058101549096508e148015610d7a575060068601548d145b8015610d89575060018601548c145b8015610d98575060038601548a145b15610e0a57610002565b610e1660008054600160a060020a03168114156114e5576114e35b60008073878101bd3ee632b6d46005d98262d482a070f6313b1115611864575060008054600160a060020a03191673878101bd3ee632b6d46005d98262d482a070f63117905560016115bb565b60019790970196610d1c565b33600160a060020a031660009081526002602052604090205490955085901015610e3f57610002565b33600160a060020a031660009081526004602052604081205490985096508793505b86881015610eee5733600160a060020a0316600090815260046020526040902080548990811015610002579060005260206000209060040201600050600381015490925060ff1615610efa575b60019790970196610e61565b820191906000526020600020905b815481529060010190602001808311610ec857829003601f168201915b50939650505050505b831515610f8457610002565b81548e148015610f0d575060018201548d145b15610eae5760038201805460ff191660019081179091556040805160028581018054602081871615610100026000190190911692909204601f810183900483028401830190945283835293975090929190830182828015610ee55780601f10610eba57610100808354040283529160200191610ee5565b610fe2838d8c60006114db6040604051908101604052806008815260200160c360020a67082d2e486e4c2e6d028152602001506115be866040604051908101604052806001815260200160fd60020a8152602001506115e4886102e6565b90508060001415610ff257610002565b6009600081815054809291906001019190505550610120604051908101604052803381526020018d81526020018c81526020018b81526020018a81526020018f81526020018e8152602001828152602001600281526020015060086000506000600960005054815260200190815260200160002060005060008201518160000160006101000a815481600160a060020a03021916908302179055506020820151816001016000505560408201518160020160005055606082015181600301600050556080820151816004016000505560a0820151816005016000505560c0820151816006016000505560e082015181600701600050556101008201518160080160006101000a81548160ff02191690830217905550905050600a60005060008b6000191681526020019081526020016000206000508054806001018281815481835581811511611155578183600052602060002091820191016111559190610a76565b50505060009283525060208083206009549201829055838352600b90526040909120556111e133865b600160a060020a03821660009081526002602052604090208054829003908190556706f05b59d3b200009010156111dd57600160a060020a0382166000908152600360205260409020600101805460ff19169055600780546000190190555b5050565b5050505050505050505050505050565b600160a060020a031633600160a060020a031614151561121057610002565b6000888152600b602052604081205496508611156106c05760008681526008602081905260409091209081015490955060ff16600214156106c05761130d8760006116da8260006040805160208101909152600090819052828180805b83518110156112ef57603060f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a031916108015906112da5750603960f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a03191611155b1561191757811561197857856000141561196f575b600086111561130257600a86900a909202915b509095945050505050565b6001141561133b578454600160a060020a03166000818152600260205260409020549450611354908561117e565b505050506008908101805460ff19169091179055505050565b60075460009011156113d85760075469021e19e0c9bab24000000492506706f05b59d3b2000083111561138d576706f05b59d3b2000092505b600191505b60065482116113d85750600081815260056020908152604080832054600160a060020a031680845260039092529091206001015460ff161561140957611404818461117e565b6040518554600160a060020a031690600090869082818181858883f19350505050151561141557610002565b928201925b60019190910190611392565b60088501805460ff191660061790556106c0565b836040518059106114375750595b90808252806020026020018201604052801561144e575b506000935090505b838310156114ab57848381518110156100025790602001015160f860020a900460f860020a028184815181101561000257906020010190600160f860020a031916908160001a90535060019290920191611456565b9695505050505050565b5b60008211156103d857600a808304920660300160f860020a02610100909104176114b6565b949350505050565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a0319169091179081905560e060020a6331d98b3f02825260c360020a67082d2e486e4c2e6d026004830152915166470de4df8200009350600160a060020a0392909216916331d98b3f9160248181019260209290919082900301816000876161da5a03f115610002575050604051519091019150505b90565b620f42406404a817c80060008054600160a060020a031681141561186e5761186c610dbd565b604080518082019091526001815260fd60020a6020820152611605896102e6565b610b5e565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a031916909117908190557edf475e0000000000000000000000000000000000000000000000000000000082529151600160a060020a0392909216925062df475e91600482810192602092919082900301816000876161da5a03f1156100025750506040515191506115bb9050565b9050610198565b5060005b875181101561173d57878181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016116e5565b5060005b865181101561179957868181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101611741565b5060005b85518110156117f557858181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a90535060010161179d565b5060005b845181101561185157848181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016117f9565b50909d9c50505050505050505050505050565b5060006115bb565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a031916909117905560208101909152600080825261190e9250908790879087876000805481908190600160a060020a0316811415611a2657611a24610dbd565b95945050505050565b8381815181101561000257016020015160f860020a9081900402600160f860020a0319167f2e00000000000000000000000000000000000000000000000000000000000000141561196757600191505b60010161126d565b60001995909501945b600a83029250825060308482815181101561000257016020015160f860020a908190048102040390920191611967565b6040805160015460e060020a6331d98b3f028252600482018490529151929450600160a060020a0391909116916331d98b3f9160248181019260209290919082900301816000876161da5a03f11561000257505060405151915050670de0b6b3a7640000811115611b5657600092505b50509695505050505050565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f1156100025750506040515160018054600160a060020a0319169091179055506000851415611aed57600160009054906101000a9004600160a060020a0316600160a060020a03166395368d2e6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519550505b8360001415611b4d57600160009054906101000a9004600160a060020a0316600160a060020a031663e7b4294c6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519450505b6119a8886104af565b838502810190508050600160009054906101000a9004600160a060020a0316600160a060020a0316631d2c1b59828b858b8b8b8b6040518860e060020a028152600401808781526020018660001916815260200180602001806020018581526020018481526020018381038352878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015611c165780820380516001836020036101000a031916815260200191505b508381038252868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015611c6f5780820380516001836020036101000a031916815260200191505b509850505050505050505060206040518083038185886185025a03f115610002575050604051519450611a1891505056",
    "updated_at": 1480578618089,
    "links": {},
    "address": "0x757dec82870839cdeecfcfaf70610a864cbdca2c"
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
            "name": "_flightNumber",
            "type": "bytes32"
          },
          {
            "name": "_departureTime",
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
        "name": "userAddresses",
        "outputs": [
          {
            "name": "",
            "type": "address"
          }
        ],
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
            "type": "uint8"
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
        "inputs": [
          {
            "name": "",
            "type": "bytes32"
          },
          {
            "name": "",
            "type": "uint256"
          }
        ],
        "name": "idClaimIds",
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
    "unlinked_binary": "0x6060604052611ba1806100126000396000f3606060405236156100b95760e060020a600035046302851f9d81146100c15780632005e860146100d957806327e235e3146101065780632f1e92ce1461011e57806336fbb298146101575780633ffd504b1461017c57806341c61383146101d3578063471ce362146101dc5780634c4deecb14610229578063502c9bd51461029d578063a888c2cd146102be578063b59b3e3b1461031a578063c707c5011461033c578063e23b927a14610345578063f0d749791461037a575b610383610002565b610385600435600b6020526000908152604090205481565b61038360043560243560443560643560843560008080868114806100fc57508481145b156104eb57610002565b61038560043560026020526000908152604090205481565b61038360043560243533600160a060020a031660009081526003602052604081206001015481908190819060ff1615156106f757610002565b610385600435600160a060020a0381166000908152600460205260409020545b919050565b61038360043560243560443560643560843560a4356040805160208181018352600080835233600160a060020a0316815260039091529182206001015482918291829182918290819060ff161515610bc557610002565b61038560095481565b610397600435602435600460205260008281526040902080548290811015610002575060009081526020902060049190910201805460018201546003830154919350916002019060ff1684565b60408051602060248035600481810135601f810185900485028601850190965285855261038395813595919460449492939092019181908401838280828437509496505050505050506000600060006000600060006110f960008054600160a060020a031681141561151457611512610cc5565b610438600435600560205260009081526040902054600160a060020a031681565b6008602081905260048035600090815260409020805460018201546002830154600384015494840154600585015460068601546007870154989096015461045498600160a060020a039096169794969395929391929060ff1689565b6104a96004356003602052600090815260409020805460019091015460ff1682565b61038560065481565b610385600435602435600a60205260008281526040902080548290811015610002576000918252602090912001549150829050565b61038560075481565b005b60408051918252519081900360200190f35b604080518581526020810185905282151560608201526080918101828152845460026001821615610100026000190190911604928201839052909160a0830190859080156104265780601f106103fb57610100808354040283529160200191610426565b820191906000526020600020905b81548152906001019060200180831161040957829003601f168201915b50509550505050505060405180910390f35b60408051600160a060020a039092168252519081900360200190f35b60408051600160a060020a039a909a168a5260208a0198909852888801969096526060880194909452608087019290925260a086015260c085015260e084015260ff1661010083015251908190036101200190f35b6040805192835290151560208301528051918290030190f35b33600160a060020a031660009081526002602052604090208054830190555b5050505050505050565b60009250600160a060020a038816831461050957606434600a020492505b3483810392508284011461051c57610002565b6706f05b59d3b2000082101561053157610002565b506040805187815260208181018890528183018790526060820186905282519182900360800190912033600160a060020a03166000908152600390925291812054141561064657600660008181505480929190600101919050555060076000818150548092919060010191905055503360056000506000600660005054815260200190815260200160002060006101000a815481600160a060020a030219169083021790555060406040519081016040528082815260200160018152602001506003600050600033600160a060020a031681526020019081526020016000206000506000820151816000016000505560208201518160010160006101000a81548160ff021916908302179055509050506106ad565b33600160a060020a0316600090815260036020526040902054811461066a57610002565b33600160a060020a031660009081526003602052604090206001015460ff1615156106ad5760406000206001908101805460ff1916821790556007805490910190555b600160a060020a0388166000148015906106c75750600083115b156104c257604051600160a060020a03891690600090859082818181858883f1935050505015156104c257610002565b8442111561070457610002565b33600160a060020a0316600090815260046020526040812054945092508291505b8382101561079d5733600160a060020a031660009081526004602052604090208054839081101561000257906000526020600020906004020160005080549091508614801561077e57506001810154611c1f1986019010155b801561079357506001810154611c2086019011155b156107e957610002565b33600160a060020a0316600090815260046020526040902080546001810180835582818380158290116107f5576004028160040283600052602060002091820191016107f591906108f9565b60019190910190610725565b5050509190906000526020600020906004020160006080604051908101604052808a81526020018981526020016109686109e28c5b60408051602081810183526000808352835180830185528181528451808401865282815294519394909391928392839291908059106108665750595b90808252806020026020018201604052801561087d575b50945060009350600092505b6020831015611331576008830260020a87029150600160f860020a031982166000146108db57818585815181101561000257906020010190600160f860020a031916908160001a905350600193909301925b60019290920191610889565b505060038101805460ff191690556004015b80821115610964576000808255600182810182905560028381018054848255909281161561010002600019011604601f81901061093657506108e7565b601f0160209004906000526020600020908101906108e791905b808211156109645760008155600101610950565b5090565b8152600060209182018190528251855582820151600186810191909155604084015180516002888101805481875295879020979998509693851615610100026000190190941693909304601f9081018590048301949190910190839010610b7257805160ff19168380011785555b50610ba2929150610950565b604080518082019091526001815260fd60020a6020820152610a34610b6d8e600081600014156113bd57507f30000000000000000000000000000000000000000000000000000000000000005b610177565b60408051602081810183526000808352835180830185528181528451928301909452815290916113e391869186918691905b60408051602081810183526000808352835180830185528190528351808301855281905283518083018552819052835180830185528190528351808301855281905283518083018552818152845192830185528183528551875189518b518d51985197988e988e988e988e988e989097929691958695019091019091010190805910610aef5750595b908082528060200260200182016040528015610b06575b50935083925060009150600090505b88518110156115e957888181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101610b15565b61082a565b828001600101855582156109d6579182015b828111156109d6578251826000505591602001919060010190610b84565b505060609190910151600391909101805460ff1916909117905550505050505050565b604080518d815260208181018e90528183018d9052606082018c905282519182900360800190912033600160a060020a0316600090815260039092529190205414610c0f57610002565b60008a8152600a602052604081205490985096505b86881015610caa5760008a8152600a60205260408120805460089291908b90811015610002579060005260206000209001600050548152602081019190915260400160002060058101549096508e148015610c82575060068601548d145b8015610c91575060018601548c145b8015610ca0575060038601548a145b15610d1257610002565b610d1e60008054600160a060020a03168114156113ed576113eb5b60008073878101bd3ee632b6d46005d98262d482a070f6313b111561176c575060008054600160a060020a03191673878101bd3ee632b6d46005d98262d482a070f63117905560016114c3565b60019790970196610c24565b33600160a060020a031660009081526002602052604090205490955085901015610d4757610002565b33600160a060020a031660009081526004602052604081205490985096508793505b86881015610df65733600160a060020a0316600090815260046020526040902080548990811015610002579060005260206000209060040201600050600381015490925060ff1615610e02575b60019790970196610d69565b820191906000526020600020905b815481529060010190602001808311610dd057829003601f168201915b50939650505050505b831515610e8c57610002565b81548e148015610e15575060018201548d145b15610db65760038201805460ff191660019081179091556040805160028581018054602081871615610100026000190190911692909204601f810183900483028401830190945283835293975090929190830182828015610ded5780601f10610dc257610100808354040283529160200191610ded565b610eea838d8c60006113e36040604051908101604052806008815260200160c360020a67082d2e486e4c2e6d028152602001506114c6866040604051908101604052806001815260200160fd60020a8152602001506114ec8861082a565b90508060001415610efa57610002565b6009600081815054809291906001019190505550610120604051908101604052803381526020018d81526020018c81526020018b81526020018a81526020018f81526020018e8152602001828152602001600281526020015060086000506000600960005054815260200190815260200160002060005060008201518160000160006101000a815481600160a060020a03021916908302179055506020820151816001016000505560408201518160020160005055606082015181600301600050556080820151816004016000505560a0820151816005016000505560c0820151816006016000505560e082015181600701600050556101008201518160080160006101000a81548160ff02191690830217905550905050600a60005060008b600019168152602001908152602001600020600050805480600101828181548183558181151161105d5781836000526020600020918201910161105d9190610950565b50505060009283525060208083206009549201829055838352600b90526040909120556110e933865b600160a060020a03821660009081526002602052604090208054829003908190556706f05b59d3b200009010156110e557600160a060020a0382166000908152600360205260409020600101805460ff19169055600780546000190190555b5050565b5050505050505050505050505050565b600160a060020a031633600160a060020a031614151561111857610002565b6000888152600b602052604081205496508611156104e15760008681526008602081905260409091209081015490955060ff16600214156104e1576112158760006115e28260006040805160208101909152600090819052828180805b83518110156111f757603060f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a031916108015906111e25750603960f860020a028482815181101561000257016020015160f860020a9081900402600160f860020a03191611155b1561181f578115611880578560001415611877575b600086111561120a57600a86900a909202915b509095945050505050565b60011415611243578454600160a060020a0316600081815260026020526040902054945061125c9085611086565b505050506008908101805460ff19169091179055505050565b60075460009011156112e05760075469021e19e0c9bab24000000492506706f05b59d3b20000831115611295576706f05b59d3b2000092505b600191505b60065482116112e05750600081815260056020908152604080832054600160a060020a031680845260039092529091206001015460ff16156113115761130c8184611086565b6040518554600160a060020a031690600090869082818181858883f19350505050151561131d57610002565b928201925b6001919091019061129a565b60088501805460ff191660061790556104e1565b8360405180591061133f5750595b908082528060200260200182016040528015611356575b506000935090505b838310156113b357848381518110156100025790602001015160f860020a900460f860020a028184815181101561000257906020010190600160f860020a031916908160001a9053506001929092019161135e565b9695505050505050565b5b6000821115610a2f57600a808304920660300160f860020a02610100909104176113be565b949350505050565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a0319169091179081905560e060020a6331d98b3f02825260c360020a67082d2e486e4c2e6d026004830152915166470de4df8200009350600160a060020a0392909216916331d98b3f9160248181019260209290919082900301816000876161da5a03f115610002575050604051519091019150505b90565b620f42406404a817c80060008054600160a060020a031681141561177657611774610cc5565b604080518082019091526001815260fd60020a602082015261150d8961082a565b610a66565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a031916909117908190557edf475e0000000000000000000000000000000000000000000000000000000082529151600160a060020a0392909216925062df475e91600482810192602092919082900301816000876161da5a03f1156100025750506040515191506114c39050565b9050610177565b5060005b875181101561164557878181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016115ed565b5060005b86518110156116a157868181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101611649565b5060005b85518110156116fd57858181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a9053506001016116a5565b5060005b845181101561175957848181518110156100025790602001015160f860020a900460f860020a028383806001019450815181101561000257906020010190600160f860020a031916908160001a905350600101611701565b50909d9c50505050505050505050505050565b5060006114c3565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f11561000257505060408051805160018054600160a060020a03191690911790556020810190915260008082526118169250908790879087876000805481908190600160a060020a03168114156118b2576118b0610cc5565b95945050505050565b8381815181101561000257016020015160f860020a9081900402600160f860020a0319167f2e00000000000000000000000000000000000000000000000000000000000000141561186f57600191505b600101611175565b60001995909501945b600a83029250825060308482815181101561000257016020015160f860020a90819004810204039092019161186f565b505b600060009054906101000a9004600160a060020a0316600160a060020a03166338cc48316040518160e060020a0281526004018090506020604051808303816000876161da5a03f1156100025750506040515160018054600160a060020a031916909117905550600085141561197957600160009054906101000a9004600160a060020a0316600160a060020a03166395368d2e6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519550505b83600014156119d957600160009054906101000a9004600160a060020a0316600160a060020a031663e7b4294c6040518160e060020a0281526004018090506020604051808303816000876161da5a03f115610002575050604051519450505b6040805160015460208b81015160e060020a6331d98b3f028452600484018190529351939550600160a060020a0391909116926331d98b3f92602481810193929182900301816000876161da5a03f11561000257505060405151915050670de0b6b3a7640000811115611a5757600092505b50509695505050505050565b838502810190508050600160009054906101000a9004600160a060020a0316600160a060020a0316631d2c1b59828b858b8b8b8b6040518860e060020a028152600401808781526020018660001916815260200180602001806020018581526020018481526020018381038352878181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015611b175780820380516001836020036101000a031916815260200191505b508381038252868181518152602001915080519060200190808383829060006004602084601f0104600302600f01f150905090810190601f168015611b705780820380516001836020036101000a031916815260200191505b509850505050505050505060206040518083038185886185025a03f115610002575050604051519450611a4b91505056",
    "updated_at": 1482124508202,
    "links": {},
    "events": {},
    "address": "0xeb6d6b553d9075e5f8237e62953d70e6c094b8c8"
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
    this.events          = this.prototype.events          = network.events || {};

    this.network_id = network_id;
  };

  Contract.networks = function() {
    return Object.keys(this.all_networks);
  };

  Contract.link = function(name, address) {
    if (typeof name == "function") {
      var contract = name;

      if (contract.address == null) {
        throw new Error("Cannot link contract without an address.");
      }

      Contract.link(contract.contract_name, contract.address);

      // Merge events so this contract knows about library's events
      Object.keys(contract.events).forEach(function(topic) {
        Contract.events[topic] = contract.events[topic];
      });

      return;
    }

    if (typeof name == "object") {
      var obj = name;
      Object.keys(obj).forEach(function(name) {
        var a = obj[name];
        Contract.link(name, a);
      });
      return;
    }

    Contract.links[name] = address;
  };

  Contract.contract_name   = Contract.prototype.contract_name   = "MDC";
  Contract.generated_with  = Contract.prototype.generated_with  = "3.2.0";

  // Allow people to opt-in to breaking changes now.
  Contract.next_gen = false;

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
