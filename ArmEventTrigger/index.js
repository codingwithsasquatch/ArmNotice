const restAzure = require('ms-rest-azure');
const ResourceManagementClient = require('azure-arm-resource').ResourceManagementClient;
const axios = require("axios");

module.exports = function (context, req) {
    context.log("Received Request: "+JSON.stringify(req.body));

    // validate the Event Grid if this is a validation request otherwise the else block is a normal event grid event
    if ("aeg-event-type" in req.headers && req.headers["aeg-event-type"] == "SubscriptionValidation") {
        context.res = { body: { "validationResponse": req.body[0].data.validationCode} };
        context.done();
    } else {
        context.log("Calling MSI for token.");
        restAzure.loginWithAppServiceMSI()
        .then( (credentials) => {
            context.log("authenticated: "+ credentials);
            req.body.forEach((event) => {
                context.log("Processing Event:\n"+JSON.stringify(event));
                var resourceClient = new ResourceManagementClient(credentials, event.data.subscriptionId);
                var resourceInfo = getResourceDetails(event.data.resourceUri);

                if (event.eventType == "Microsoft.Resources.ResourceWriteSuccess") {
                    resourceClient.providers.get(resourceInfo.provider)
                    .then( (providerInfo) => {
                        context.log("ProviderInfo:\n"+ JSON.stringify(providerInfo));
                        var resourceTypeInfo = providerInfo.resourceTypes.find( (item) => { return item.resourceType == resourceInfo.resourceType;});
                        context.log("ResourceTypeInfo:\n"+ JSON.stringify(resourceTypeInfo));
                        resourceInfo.apiVersion = resourceTypeInfo.apiVersions[0];
                        resourceClient.resources.getById(event.data.resourceUri, resourceInfo.apiVersion)
                        .then( (resource) => {
                            context.log("Got resource status: "+resource);
                            event.data.resourceStatus = resource;
                            event.topic = null;
                            context.log("New event to rethrow is:\n"+JSON.stringify(event));
                            axios.post(process.env['EventGridCustomTopicEndpoint'], [event], { headers: {'aeg-sas-key': process.env['EventGridCustomTopicKey']}})
                            .then( (response) => {
                                context.res = { status: 200 };
                                context.done();
                            }).catch( (error) => {
                                context.log(error);
                                context.res = { status: 500 };
                                context.done();
                            });
                        }).catch( (error) => {
                            context.log(error);
                            context.res = { status: 500 };
                            context.done();
                        });
                    }).catch( (error) => {
                        context.log(error);
                        context.res = { status: 500 };
                        context.done();
                    });
                } else {
                    event.topic = null;
                    context.log("Just rethrow event for deletes");
                    axios.post(process.env['EventGridCustomTopicEndpoint'], [event], { headers: {'aeg-sas-key': process.env['EventGridCustomTopicKey']}})
                        .then( (response) => {
                            context.res = { status: 200 };
                            context.done();
                        }).catch( (error) => {
                            context.log(error);
                            context.res = { status: 500 };
                            context.done();
                        });
                }
            });
        }).catch( (error) => {
            context.log(error);
            context.res = { status: 500 };
            context.done();
        });
    }
};

function getResourceDetails(resourceUri) {
    const resourceUriParts = resourceUri.split("/");
    var resourceType = resourceUriParts[7] || null;

    if (resourceType != null) {
        for (var i=9; i<resourceUriParts.length; i+=2) {
            resourceType += '/'+resourceUriParts[i];
        }
    }

    return { 
        resourceUri: resourceUri,
        subscriptionID: resourceUriParts[2],
        resourceGroup: resourceUriParts[4] || null,
        provider: resourceUriParts[6] || null,
        resourceType: resourceType
    };
}