# Branch Management — Delta (país + Places)

## ADDED Requirements

### Requirement: Branch has ISO country code

The system SHALL persist `Branch.countryCode` as ISO 3166-1 alpha-2. Default MUST be `CO` when omitted. Create/edit UI MUST offer a searchable country combobox (flag + name). Dashboard, v1 and MCP branch payloads MUST include `countryCode`.

#### Scenario: Default country on create

- GIVEN a user opens "Nueva sucursal"
- WHEN the form renders without a previous country
- THEN the country field is Colombia (`CO`)

#### Scenario: Country is stored and listed

- GIVEN a branch is saved with `countryCode` `PA`
- WHEN the branch list or v1 `GET /api/v1/branches` loads
- THEN the payload includes `countryCode: "PA"`

### Requirement: Address search is scoped to the branch country

`BranchLocationPicker` MUST call Places Autocomplete (New) with `includedRegionCodes` set to the selected country (lowercase ISO). It MUST NOT send `locationBias` with a country-scale radius. If Autocomplete returns HTTP 400, the cause is an invalid request parameter (typical: circle radius > 50 km), not a missing API key.

#### Scenario: Search stays in selected country

- GIVEN the branch country is Colombia
- WHEN the user types an address of at least 3 characters
- THEN suggestions are restricted with `includedRegionCodes: ["co"]`
- AND the request has no `locationBias` circle larger than 50_000 m

#### Scenario: Place from another country is rejected

- GIVEN the branch country is `CO`
- WHEN the user selects a Place whose address country is not `CO`
- THEN the picker MUST NOT apply that place to the form
