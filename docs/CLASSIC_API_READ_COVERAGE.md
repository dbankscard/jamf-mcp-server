# Classic API Read Coverage

## Audit source and scope

This audit compares `JamfApiClientHybrid` with Jamf's maintained
[Classic API Postman collection](https://github.com/jamf/Classic-API-Postman-Collection),
using the `Classic API (v10.35.0+)` collection retrieved on 17 July 2026.

The collection contains 305 documented `GET` requests across 75 Classic API
resource families. The connector already has dedicated Classic API handling for
24 families. The 51 families below did not have a dedicated Code Mode method.

`jamf.getClassicApiResource(resourcePath)` now provides JSON `GET` access to
the 37 non-sensitive resource families marked **Available**. It accepts a
relative path such as `computercheckin/id/123`, validates each path segment,
uses the existing authenticated transport, and requires `read:classic_api`.

## Missing resource families

| Resource family | Documented GET routes | Status |
| --- | ---: | --- |
| activationcode | 1 | Deferred — activation code is sensitive |
| advancedmobiledevicesearches | 3 | Available |
| advancedusersearches | 3 | Available |
| allowedfileextensions | 3 | Available |
| byoprofiles | 3 | Available |
| classes | 3 | Available |
| computerapplications | 4 | Available |
| computercheckin | 1 | Available |
| computerconfigurations | 3 | Available |
| computerhardwaresoftwarereports | 10 | Available |
| computerinventorycollection | 1 | Available |
| computerinvitations | 3 | Deferred — invitation data may be sensitive |
| computermanagement | 25 | Available |
| directorybindings | 3 | Deferred — directory configuration may contain credentials |
| diskencryptionconfigurations | 3 | Deferred — encryption configuration requires a redacting wrapper |
| distributionpoints | 3 | Deferred — distribution point configuration may contain credentials |
| dockitems | 3 | Available |
| ebooks | 5 | Available |
| gsxconnection | 1 | Deferred — connection configuration may contain credentials |
| healthcarelistener | 2 | Available |
| healthcarelistenerrule | 2 | Available |
| ibeacons | 3 | Available |
| infrastructuremanager | 2 | Deferred — infrastructure configuration may contain credentials |
| jsonwebtokenconfigurations | 2 | Deferred — JWT configuration is sensitive |
| ldapservers | 9 | Deferred — directory configuration may contain credentials |
| licensedsoftware | 3 | Available |
| macapplications | 5 | Available |
| managedpreferenceprofiles | 5 | Available |
| mobiledeviceenrollmentprofiles | 6 | Available |
| mobiledeviceextensionattributes | 3 | Available |
| mobiledevicehistory | 10 | Available |
| mobiledeviceinvitations | 3 | Deferred — invitation data may be sensitive |
| netbootservers | 3 | Available |
| patchavailabletitles | 1 | Available |
| patchexternalsources | 3 | Available |
| patchinternalsources | 3 | Available |
| patchpolicies | 4 | Available |
| patchreports | 2 | Available |
| patchsoftwaretitles | 2 | Available |
| peripherals | 3 | Available |
| peripheraltypes | 2 | Available |
| printers | 3 | Available |
| removablemacaddresses | 3 | Available |
| sites | 3 | Available |
| smtpserver | 1 | Deferred — SMTP configuration may contain credentials |
| softwareupdateservers | 3 | Deferred — update-server configuration may contain credentials |
| userextensionattributes | 3 | Available |
| usergroups | 3 | Available |
| vppaccounts | 2 | Deferred — VPP account data may contain tokens |
| vppassignments | 2 | Available |
| vppinvitations | 3 | Deferred — invitation data may be sensitive |

## Existing dedicated coverage

The following 24 resource families already have dedicated connector handling:

`accounts`, `advancedcomputersearches`, `buildings`, `categories`,
`computerapplicationusage`, `computercommands`, `computerextensionattributes`,
`computergroups`, `computerhistory`, `computers`, `departments`,
`mobiledeviceapplications`, `mobiledevicecommands`,
`mobiledeviceconfigurationprofiles`, `mobiledevicegroups`, `mobiledevices`,
`networksegments`, `osxconfigurationprofiles`, `packages`, `policies`,
`restrictedsoftware`, `scripts`, `users`, and `webhooks`.

## Implementation plan

1. **This change: safe generic reads.** Maintain the allowlist in
   `JamfApiClientHybrid`, validate a path before authentication, issue only a
   Classic API `GET` with `Accept: application/json`, and expose it through the
   Code Mode policy engine as `read:classic_api`.
2. **Next: dedicated high-value wrappers.** Add typed methods for the resource
   families most often needed in reports, beginning with `mobiledevicehistory`,
   `patchsoftwaretitles`, `patchpolicies`, and `computerapplications`. Each
   wrapper should use the existing four-layer pattern: client, interface,
   policy/search metadata, and tests.
3. **Sensitive families: redaction first.** Do not add raw access to the 14
   deferred families. Before exposing any of them, establish a field-level
   redaction contract, add fixtures proving secrets cannot be returned, and use
   a narrowly scoped capability rather than `read:classic_api`.
4. **Keep the audit current.** When Jamf updates its Postman collection, rerun
   this resource-family comparison and add new read resources to the allowlist
   only after security review.

## Examples

```javascript
return await jamf.getClassicApiResource('mobiledevicehistory/id/123');
```

```javascript
return await jamf.getClassicApiResource('patchsoftwaretitles');
```

Both examples require:

```json
{ "capabilities": ["read:classic_api"] }
```
