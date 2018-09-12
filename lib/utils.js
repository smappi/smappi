const fs = require('fs');

function cwd (entrypoint, path) {
    return [process.cwd(), entrypoint, path].join('/').replace(/\/\//g, '/');
}

function getType(input, types) {
    let xsdTypes = ['anySimpleType', 'anyURI', 'base64Binary', 'boolean', 'byte', 'date', 'dateTime', 'decimal', 'double', 'duration', 'unsignedInt', 'unsignedLong', 'unsignedShort',
    'float', 'gDay', 'gMonth', 'gMonthDay', 'gYear', 'gYearMonth', 'hexBinary', 'int', 'integer', 'language', 'long', 'negativeInteger', 'nonNegativeInteger',
    'nonPositiveInteger', 'normalizedString', 'positiveInteger', 'short', 'string', 'time', 'token', 'unsignedByte']
    if (input && types && typeof(types) == "object" && types[input.trim()]) {
        return `tns:${escape((input + '').trim())}`
    }
    if (input.trim().toLowerCase() == 'number') return 'xsd:int'
    if (xsdTypes.indexOf((input + '').trim()) < 0) return 
    return `xsd:${escape((input + '').trim())}`
}

function buildSchemes(api, namespace) {
    if (!api)
        return {error: 'no api'}
    let _scheme = api._scheme,
        out = {warning: []},
        bindings = '',
        portTypes = '',
        types = '',
        messages = '';
    if (!namespace)
        namespace = 'http://localhost:8000';
    if (!_scheme)
        return {error: "SOAP and GraphQL will not work: where is no _scheme exports in api.js file."}
    if (!_scheme.methods || typeof(_scheme.methods) != "object")
        return {error: "SOAP and GraphQL will not work: where is no methods declared in _scheme."}
    // TYPES
    let buildTypes = function(itemSet, keyName) {
        let tmpOut = {
                warning: [],
                types: ''
            };
        if (!typeof(itemSet) == "object") return tmpOut
        for (let key in itemSet){
            let type = itemSet[key],
                keyName = escape(key.trim()),
                els = '',
                isArray = false;
            if (!Array.isArray(type)) {
                for (let el in type){
                    if (el == '__isArray') {
                        if (itemSet[el] == true)
                            isArray = true;
                        continue;
                    }
                    els += `<xsd:element name="${el}" type="${getType(type[el], _scheme.types)}"/>`;
                }
            } else {
                tmpOut.warning.push(`[${key}] contains types, but it is array. We will set types as strings, but better to specify it.`);
                for (let i = 0, el; el = type[i]; i++) {
                    if (el == '__isArray') {
                        isArray = true;
                        continue;
                    }
                    els += `<xsd:element name="${el}" type="xsd:string"/>`;
                }
            }
            if (!isArray)
                tmpOut.types += `
                <xsd:complexType name="${keyName}">
                    <xsd:all>
                        ${els}
                    </xsd:all>
                </xsd:complexType>
                `
            else
                tmpOut.types += `
                <xsd:complexType name="${keyName}ArrayElement">
                    <xsd:all>
                        ${tmpTypes}
                    </xsd:all>
                </xsd:complexType>
                <xsd:complexType>
                    <xsd:sequence>
                        <xsd:element name="${keyName}" type="tns:${keyName}ArrayElement" minOccurs="0" maxOccurs="unbounded"/>
                    </xsd:sequence>
                </xsd:complexType>
                `
        }
        return tmpOut
    }
    let buildFuncParams = function(itemSet, keyName, key, paramsType) {
        let tmpOut = {
                warning: [],
                messages:'',
                types:''
            },
            isArray = false,
            tmpTypes = '';
        paramsType = paramsType.trim().toLowerCase();
        if (!typeof(itemSet) == "object" || ['out', 'in'].indexOf(paramsType) < 0) return tmpOut;
        tmpOut.messages += `<message name="${keyName + (paramsType == 'out' ? 'Out' : 'In')}">
            <part name="parameters" element="tns:${keyName + (paramsType == 'out' ? 'Response' : '')}"/>
        </message>`
        if (!Array.isArray(itemSet))
            for (let item in itemSet) {
                if (item == '__isArray') {
                    if (itemSet[item] == true)
                        isArray = true;
                    continue;
                }
                let type = itemSet[item] + '';
                tmpTypes += `<xsd:element name="${escape(item.trim())}" type="${getType(type, _scheme.types)}"/>`
            }
        else {
            tmpOut.warning.push(`[${key}] includes ${paramsType}, but it is array. We set it all to string type, but better to specify it.`);
            for (let i = 0, item; item = itemSet[i]; i++) {
                if (item == '__isArray') {
                    isArray = true;
                    continue;
                }
                tmpTypes += `<xsd:element name="${escape(item.trim())}" type="xsd:string"/>`
            }
        }
        if (!isArray)
            tmpOut.types +=`<xsd:element name="${keyName + (paramsType == 'out' ? 'Response' : '')}">
                <xsd:complexType>
                    <xsd:all>
                        ${tmpTypes}
                    </xsd:all>
                </xsd:complexType>
            </xsd:element>`
        else {
            tmpOut.types += `<xsd:complexType name="${keyName}ArrayElement">
                <xsd:all>
                    ${tmpTypes}
                </xsd:all>
            </xsd:complexType>
            <xsd:element name="${keyName + (paramsType == 'out' ? 'Response' : '')}">
                <xsd:complexType>
                    <xsd:sequence>
                        <xsd:element name="item" type="tns:${keyName}ArrayElement" minOccurs="0" maxOccurs="unbounded"/>
                    </xsd:sequence>
                </xsd:complexType>
            </xsd:element>
            `
        }
        return tmpOut
    }
    if (_scheme.types && typeof(_scheme.types) == "object") {
        let tmp = buildTypes(_scheme.types)
        out.warning.concat(tmp.warning);
        types += tmp.types || '';
    }

    // METHODS
    if (_scheme.methods && typeof(_scheme.methods) == "object")
        for (let key in _scheme.methods) {
            if (api[key]) {
                let fnc = _scheme.methods[key],
                    keyName = escape(key.trim());
                // GENERATE MESSAGES
                bindings += `<operation name="${keyName}">
                    <soap:operation soapAction="${namespace}/${keyName}"/>
                    <input>
                        <soap:body use="literal"/>
                    </input>
                    <output>
                        <soap:body use="literal"/>
                    </output>
                    </operation>`;
                portTypes += `<operation name="${keyName}">
                        <documentation>${keyName}</documentation>
                        <input message="tns:${keyName}In"/>
                        <output message="tns:${keyName}Out"/>
                    </operation>`;
                // INPUT
                if (typeof(fnc.in) == "object") {
                    let tmp = buildFuncParams(fnc.in, keyName, key, 'in');
                    out.warning.concat(tmp.warning);
                    messages += tmp.messages || '';
                    types += tmp.types || '';
                    // messages += `<message name="${keyName}In">`
                    // if (!Array.isArray(fnc.in))
                    //     for (let item in fnc.in) {
                    //         let type = fnc.in[item] + '';
                    //         messages += `<part name="${escape(item.trim())}" type="${getType(type, _scheme.types)}"/>`
                    //     }
                    // else {
                    //     out.warning.push(`[${key}] includes "in", but it is array. We can generate types, but better to specify it.`);
                    //     for (let i = 0, item; item = fnc.in[i]; i++) {
                    //         messages += `<part name="${escape(item.trim())}" type="xsd:string"/>`
                    //     }
                    // }
                    // messages += "</message>"
                } else {
                    if (_scheme.types && _scheme.types[fnc.in]){
                        let tmp = buildFuncParams(_scheme.types[fnc.in], keyName, key, 'in');
                        out.warning.concat(tmp.warning);
                        messages += tmp.messages || '';
                        types += tmp.types || '';
                    }
                    // if (_scheme.types && _scheme.types[fnc.in]) {
                    //     messages += `<message name="${keyName}In">`
                    //     if (!Array.isArray(_scheme.types[fnc.in]))
                    //         for (let item in _scheme.types[fnc.in]) {
                    //             let type = _scheme.types[fnc.in][item] + '';
                    //             messages += `<part name="${escape(item.trim())}" type="${getType(type, _scheme.types)}"/>`
                    //         }
                    //     else {
                    //         for (let i = 0, item; item = _scheme.types[fnc.in][i]; i++) {
                    //             messages += `<part name="${escape(item.trim())}" type="xsd:string"/>`
                    //         }
                    //     }
                    //     messages += "</message>"
                    //  }
                    else
                        out.warning.push(`[${key}] includes invalid "in" format. We can generate it, but better to specify it.`);
                }
                // OUTPUT
                if (typeof(fnc.out) == "object") {
                    let tmp = buildFuncParams(fnc.out, keyName, key, 'out');
                    out.warning.concat(tmp.warning);
                    messages += tmp.messages || '';
                    types += tmp.types || '';
                } else {
                    if (_scheme.types && _scheme.types[fnc.out]){
                        let tmp = buildFuncParams(_scheme.types[fnc.out], keyName, key, 'out');
                        out.warning.concat(tmp.warning);
                        messages += tmp.messages || '';
                        types += tmp.types || '';
                    } else if (getType(fnc.out, _scheme.types)){
                        messages += `<message name="${keyName}Out">
                            <part name="${keyName}Response" type="${getType(fnc.out, _scheme.types)}"/>
                        </message>`
                    } else
                        return {error: `[${key}] includes invalid "out" format.`};
                }
            }
        }
    else
        return {error: `no methods is specified in _scheme or they are specifed incorect.`}
    out.wsdl = `
        <definitions xmlns="http://schemas.xmlsoap.org/wsdl/"
                     xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
                     xmlns:tns="${namespace}"
                     xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/"
                     xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                     xmlns:soap-enc="http://schemas.xmlsoap.org/soap/encoding/"
                     xmlns:soap12="http://schemas.xmlsoap.org/wsdl/soap12/"
                     name="ApiSoap"
                     targetNamespace="${namespace}">
            <types>
                <xsd:schema targetNamespace="${namespace}">${types}</xsd:schema>
            </types>
            ${messages}
            <portType name="ApiSoapPort">
                ${portTypes}
            </portType>
            <binding name="ApiSoapBinding" type="tns:ApiSoapPort">
                <soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/>
                ${bindings}
            </binding>
            <service name="ApiSoapService">
            <port name="ApiSoapPort" binding="tns:ApiSoapBinding">
            <soap:address location="${namespace}"/>
            </port>
            </service>
        </definitions>
    `.trim()
    return out
}

module.exports = { cwd, buildSchemes };
