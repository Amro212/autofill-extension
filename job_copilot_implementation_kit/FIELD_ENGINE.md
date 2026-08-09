# Field Engine

## 1. Normalized field model

All generic scanning and ATS adapters must produce the same normalized model.

```ts
type FieldKind =
  | "text"
  | "textarea"
  | "email"
  | "tel"
  | "url"
  | "number"
  | "date"
  | "native-select"
  | "radio-group"
  | "checkbox"
  | "checkbox-group"
  | "combobox"
  | "autocomplete"
  | "multi-select"
  | "contenteditable"
  | "rich-text"
  | "file"
  | "custom";

interface NormalizedField {
  id: string;
  adapterId: string;
  pageKey: string;

  kind: FieldKind;
  semanticType?: string;

  label: string;
  description?: string;
  section?: string;

  required: boolean;
  currentValue: unknown;

  options?: Array<{
    label: string;
    value?: string;
    disabled?: boolean;
  }>;

  constraints?: {
    maxLength?: number;
    minLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    acceptedFileTypes?: string[];
  };

  evidence: {
    labelFor?: boolean;
    wrappingLabel?: boolean;
    ariaLabel?: boolean;
    ariaLabelledBy?: boolean;
    ariaDescribedBy?: boolean;
    legend?: boolean;
    nearbyHeading?: boolean;
    placeholder?: boolean;
    adapterRule?: string;
  };

  confidence: number;
}
```

Element references stay inside the browser runtime.

Backend receives serializable field models only.

## 2. Discovery cascade

```text
ATS-specific scanner
       |
       v
generic semantic scanner
       |
       v
normalize/dedupe
       |
       v
field registry
```

A platform adapter should enhance generic detection, not disable fallback discovery.

## 3. Label extraction

Evidence order should include:
1. `label[for=id]`
2. wrapping `<label>`
3. `aria-label`
4. `aria-labelledby`
5. `aria-describedby`
6. `fieldset` + `legend`
7. nearest structured form-item label
8. section heading
9. nearby sibling text
10. placeholder
11. name/id humanization as last resort
12. ATS-specific rules

Never rely on placeholder alone when better semantics exist.

## 4. Main-world action bridge

The page interaction API should expose commands such as:

```ts
type PageAction =
  | { type: "set-text"; fieldId: string; value: string }
  | { type: "select-option"; fieldId: string; value: string }
  | { type: "toggle"; fieldId: string; checked: boolean }
  | { type: "choose-radio"; fieldId: string; value: string }
  | { type: "set-date"; fieldId: string; value: string }
  | { type: "upload"; fieldId: string; documentHandle: string };
```

The isolated content script decides.
The smallest possible main-world executor acts.

Do not send profile, resume, API keys, or full application context into page-world globals.

## 5. Native text controls

Preferred behavior:
1. scroll into view
2. focus
3. call native prototype setter when needed
4. dispatch appropriate `input`
5. dispatch `change` when relevant
6. blur where the site validates on blur
7. read the actual value back
8. wait briefly for framework reconciliation
9. verify again

No typing animation required.

## 6. Native selects

Match:
1. exact option value
2. exact visible text
3. normalized exact text
4. safe fuzzy match
5. AI repair if ambiguous

Always verify resulting selected option.

## 7. Custom comboboxes/autocomplete

Behavior:
1. scroll trigger into view
2. open the real rendered control
3. wait for visible listbox/options
4. if async, wait until option list stabilizes
5. match exact first
6. click visible option
7. wait for control close / selected state
8. verify visible selected value

Do not manipulate hidden state if the real widget can be driven reliably.

## 8. Radios and checkboxes

Normalize grouped controls as one logical field where appropriate.

Match using:
- actual value
- associated label
- visible option text
- adapter knowledge

Use native checked setters plus events when appropriate.
If the native input is visually hidden behind a widget, use the visible proxy when required.

## 9. Dates

Normalize AI-facing dates to ISO (`YYYY-MM-DD`) unless field metadata/adapter requires a different representation.

Adapters own site-specific date-picker behavior.

## 10. Rich text/contenteditable

Set plain text safely by default.
Preserve formatting only if required by the site.

Verify text content after framework reconciliation.

## 11. File uploads

Support:
- visible file inputs
- hidden file inputs
- custom upload buttons
- drag/drop wrappers where underlying file input exists
- ATS "choose previously uploaded document" widgets

Typical browser flow:
1. backend returns approved document bytes + metadata to extension
2. extension creates a `File`
3. construct `DataTransfer`
4. assign `input.files` where supported
5. fire expected events
6. observe upload state
7. verify filename/server success indicator

Never mark upload successful only because `change` fired.

## 12. Existing values

AI Autofill may overwrite both blank and prefilled fields.

Before every mutation, capture:
- old value
- new value
- field
- timestamp
- source

Provide Undo where technically practical.

## 13. Visual statuses

Extension overlay state:
- detected
- generating
- filled
- rewritten
- inferred
- warning
- retrying
- failed

Do not permanently mutate host styles.

## 14. Rewrite

Every AI-written narrative field gets a small Rewrite control.

Rewrite payload includes:
- question
- current answer
- optional user feedback
- job context
- applicant context
- relevant memories
- field constraints

Only that field is changed.

## 15. Validation repair

Before navigation inspect:
- `required`
- `aria-required`
- `aria-invalid`
- native validity
- error summary
- field-local validation text
- disabled Continue button
- upload completion
- site/adapter validation patterns

If invalid:
- map error -> field
- attempt local fix
- if semantic answer is wrong, call AI repair for failing fields
- verify again
- only navigate after page is considered valid or retries are exhausted
