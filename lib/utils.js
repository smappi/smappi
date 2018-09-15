const fs = require('fs');

function cwd (entrypoint, path) {
    return [process.cwd(), entrypoint, path].join('/').replace(/\/\//g, '/');
}

function getType(input, types) {
    input.trim()
    let xsdTypes = [
        'anySimpleType', 'anyURI', 'base64Binary', 'boolean', 'byte', 'date', 'dateTime', 'decimal', 'double', 'duration', 'unsignedInt', 'unsignedLong',
        'float', 'gDay', 'gMonth', 'gMonthDay', 'gYear', 'gYearMonth', 'hexBinary', 'int', 'integer', 'language', 'long', 'negativeInteger', 'nonNegativeInteger',
        'non-PositiveInteger', 'normalizedString', 'positiveInteger', 'short', 'string', 'time', 'token', 'unsignedShort', 'unsignedByte'
    ];
    if (input && types && typeof(types) == "object" && types[input.trim()]) {
        return `tns:${escape((input + '').trim())}`
    }
    if (input.trim().toLowerCase() == 'number') return 'xsd:int'
    if (xsdTypes.indexOf((input + '').trim()) < 0) return
    return `xsd:${escape((input + '').trim())}`
}

let buildType = function(params, typeElName, externalTypes, parentName) {
    let type = '',
        els = [],
        typeName = '',
        additionalTypes = [],
        isArray = false,
        globalArray = false;
    if (typeof(params) == 'object') {
        // build inner elements
        if (params.__isArray) {
            globalArray = params.__isArray;
        }
        delete params.__isArray;

        // can't be this way, as far as I see. it means param don't have a name
        // if (params.__type) {
        // }
        for (let i = 0; paramName = Object.keys(params)[i]; i++) {
            isArray = false;
            let param = params[paramName];
            if (param.__isArray && param.__type) {
                isArray = param.__isArray;
                delete param.__isArray;
            }

            let el = {};
            if (param.__type)
                el = buildElement(paramName, param.__type, isArray, externalTypes);
            else
                el = buildElement(paramName, param, isArray, externalTypes);
            els.push(el.el);
            additionalTypes = additionalTypes.concat(el.additionalTypes);
        }
        // build type envelope
        if (!globalArray) {
            type += `
                <xsd:complexType ${(typeElName? "name='" + typeElName + "'": "")}>
                    <xsd:sequence>
            `
            for (let i = 0; i < els.length; i++)
                type += els[i];
            type += `
                    </xsd:sequence>
                </xsd:complexType>
            `
        } else {
            let prefix = typeElName || parentName || `a${Math.round(Math.random()*1000)}`,
                ad = `
                    <xsd:complexType name="${prefix}ArrayElement">
                        <xsd:sequence>`;
            for (let i = 0; i < els.length; i++)
            ad += els[i];
            ad += `</xsd:sequence>
                </xsd:complexType>
            `;
            // HACK in first element in Response in array
            if (parentName && parentName.indexOf('Response') > 0)
                type += `
                    <xsd:complexType ${(typeElName? "name='" + typeElName + "'": "")}>
                        <xsd:sequence>
                            <xsd:element name="item" type="tns:${prefix}ArrayElement" minOccurs="0" maxOccurs="unbounded"/>
                        </xsd:sequence>
                    </xsd:complexType>
                `
            else
                typeName += `tns:${prefix}ArrayElement`
            additionalTypes.push(ad);
        }
    // if type is just string
    } else {
        typeName = getType(params, externalTypes)
    }
    return {
        type,
        typeName,
        additionalTypes
    }
}

let buildElement = function(name, type, isArray, externalTypes){
    let typeC = JSON.parse(JSON.stringify(type)),
        elType = buildType(type, '', externalTypes, name),
        additionalTypes = [],
        el = '';
    if (!isArray && typeof(typeC) == 'object'){
        isArray = typeC.__isArray
    };
    if (elType.typeName) {
        el += `<xsd:element name="${name}" type="${elType.typeName}" ${(isArray? 'minOccurs="0" maxOccurs="unbounded"' : '')}/>`;
    } else {
        el += `
            <xsd:element name="${name}">
                ${elType.type}
            </xsd:element>
        `;
    }
    additionalTypes = additionalTypes.concat(elType.additionalTypes);
    return {
        el,
        additionalTypes,
    }
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
    if (_scheme.types && typeof(_scheme.types) == "object")
        for (let el in _scheme.types) {
            let tmp = buildType(_scheme.types[el], el)
            if (tmp.error)
                return {error: tmp.error }
            out.warning = out.warning.concat(tmp.warning);
            for (let i = 0; i < tmp.additionalTypes.length; i++)
                types += tmp.additionalTypes[i] || ''
            types += tmp.type || '';
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
                messages += `<message name="${keyName}In">
                    <part name="parameters" element="tns:${keyName}"/>
                </message>`;
                let tmp = buildElement(keyName, fnc.in, false, _scheme.types);
                for (let i = 0; i < tmp.additionalTypes.length; i++)
                    types += tmp.additionalTypes[i];
                types += tmp.el;

                // OUTPUT
                messages += `<message name="${keyName}Out">
                    <part name="parameters" element="tns:${keyName}Response"/>
                </message>`;
                tmp = buildElement(`${keyName}Response`, fnc.out, false, _scheme.types);
                for (let i = 0; i < tmp.additionalTypes.length; i++)
                    types += tmp.additionalTypes[i];
                types += tmp.el;

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
