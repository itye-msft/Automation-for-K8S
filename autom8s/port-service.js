"use strict";

const Client = require('kubernetes-client').Client;
const config = require('kubernetes-client').config;

class PortService {

    constructor(){
        //setup an API client
        let client;
        try {
            //assuming we are in the pod, try get the credentials from account service
            client = new Client({ config: config.getInCluster() });
        } catch (e) {
            //we must be debugging locally, than pickup credentials from kube config
            client = new Client({ config: config.fromKubeconfig() });
        }
        this.specLoaded = false;
        this.client = client;
        
        //gather settings to operate
        this.settings = {
            LoadBalancerNamespace: process.env.LoadBalancerNamespace || "default",
            IngressLabel: process.env.IngressLabel || "",
            PortMin: process.env.PortMin || "20000",
            PortMax: process.env.PortMax || "30000"
        }
    }

    async getExistingPorts() {
        if(!this.specLoaded){
            await this.client.loadSpec();
            this.specLoaded = true;
        }
        var self = this;
        console.log("Getting existing ports...");
        return this.client.api.v1.namespaces(this.settings.LoadBalancerNamespace).services.get()
            .then(function (services) {
                //select only load balancers
                let LoadBalancers = self._getLoadBalancersByLabel(services);
                let list = self._listPorts(LoadBalancers);
                console.log("Got ports: "+ list);
                return list;
            });
    }

    async getPort(lbip) {
        if(!this.specLoaded){
            await this.client.loadSpec();
            this.specLoaded = true;
        }
        //make an API call for all services in the given namespace
        var self = this;
        console.log("Getting port");
        return this.client.api.v1.namespaces(this.settings.LoadBalancerNamespace).services.get()
            .then(function (services) {
                //select only load balancers
                let LoadBalancers = self._getLoadBalancersByLabel(services);
                console.log("Found " + LoadBalancers.length + " Load balancers");
                if (LoadBalancers.length == 0) {
                    //exit with error
                    return { "error": "Could not find any load balancers in namepspace: " + this.settings.LoadBalancerNamespace };
                }
                else {
                    //prepare the load balancer to work with.
                    let service = null;
    
                    //If a specific LoadBlanacer was requested by IP
                    if (lbip != undefined && lbip != "") {
                        service = self._getLoadBalancerByIP(LoadBalancers, lbip)
                    }
                    else {
                        //Else, In order to alocate a free port evenly from the load balancers, select a random one.
                        service = self._getRandomLoadBalancer(LoadBalancers);
                    }
    
                    if (service == null) {
                        //exit with error
                        return { "error": "Could not allocate load balancer" };
                    }
                    else {
                        console.log("Attempting to find a free port");
                        let freeProt = self._getFreePort(service);
                        var response = {
                            "public_ip": service.status.loadBalancer.ingress[0].ip,
                            "port": freeProt,
                            "release": service.spec.selector.release
                        };
                        console.log(JSON.stringify(response));
                        return response;
                    }
                }
            });
    }

    _getLoadBalancerByIP(LoadBalancers, IP) {
        LoadBalancers.forEach(lb => {
            if (lb.status.loadBalancer.ingress[0].ip == IP) {
                return lb;
            }
        });
        return null;
    }

    _getRandomLoadBalancer(LoadBalancers) {
        let randomServiceIndex = Math.floor((Math.random() * LoadBalancers.length) + 0);
        return LoadBalancers[randomServiceIndex];
    }

    _getFreePort(service) {
        var portsInUse = [];
    
        service.spec.ports.forEach(portItem => {
            portsInUse.push(portItem.port);
        });
    
        //start searching for a free port
        let currentPort = parseInt(this.settings.PortMin);
        let max = parseInt(this.settings.PortMax);
    
        while (currentPort <= max && portsInUse.includes(currentPort)) {
            //while in ports
            currentPort++;
        }
        return currentPort;
    }

    _getLoadBalancersByLabel(services) {
        //select only load balancers
        let LoadBalancers = [];
        services.body.items.forEach(service => {
            if (service.spec.type == "LoadBalancer") {
                //match to label if applicable
                if (this.settings.IngressLabel != null && this.settings.IngressLabel != "") {
                    for (var key in service.metadata.labels) {
                        //we are looking for a pre-defined label call appingress, having a value setup in env variable
                        if (key == "appingress" && service.metadata.labels[key] == this.settings.IngressLabel) {
                            LoadBalancers.push(service);
                        }
                    }
                }
                else {
                    //if no labels are defined, than take load balancers
                    LoadBalancers.push(service);
                }
            }
        });
        return LoadBalancers;
    }

    _listPorts(LoadBalancers) {
        var list = [];
        LoadBalancers.forEach(service => {
            service.spec.ports.forEach(portItem => {
                list.push({
                    "external_port": portItem.port,
                    "node_port": portItem.nodePort,
                    "protocol": portItem.protocol,
                    "name": portItem.name,
                    "public_ip": service.status.loadBalancer.ingress[0].ip,
                    "release": service.spec.selector.release
                });
            });
        });
        return list;
    }
}

module.exports = PortService;