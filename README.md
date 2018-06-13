# ArmNotice

This solution can be deployed into a subscription and it will consume Resource Manager event grid events and add full resource config information where possible. It then send the event with this additional information on a custom topic Event Grid. Feel free to modify the  ode to customize to meet your needs

[![Deploy to Azure](http://azuredeploy.net/deploybutton.svg)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fcodingwithsasquatch%2FArmNotice%2Fmaster%2Fazuredeploy.json)