// Custom elements for the shadow DOM page. Defined once per window (guarded), so remounts, hot reloads
// and the same-origin iframe (which has its own registry) never throw "already defined".

const STYLE = `
  :host { display: block; font: inherit; color: inherit; }
  .box { border: 1px dashed #7c3aed; border-radius: 8px; padding: 10px; margin: 6px 0; }
  label { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 0.85rem; max-width: 320px; }
  input { font: inherit; padding: 6px 8px; border: 1px solid #b9c0d0; border-radius: 6px; }
  button { font: inherit; padding: 6px 12px; border-radius: 6px; border: 1px solid #b9c0d0; background: #fff; cursor: pointer; margin-top: 6px; }
  .out { font-size: 0.85rem; color: #5b6478; margin-top: 4px; }
`

/** Dispatches an event that crosses every shadow boundary up to the document. */
function emit(from: Element, name: string, detail: Record<string, unknown>) {
  from.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }))
}

/** Open shadow root: input + button. Labels configurable through attributes. */
class TpOpenCard extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const field = this.getAttribute('field-label') ?? 'Shadow name'
    const button = this.getAttribute('button-label') ?? 'Save in shadow'
    const event = this.getAttribute('event') ?? 'tp-shadow-save'
    root.innerHTML = `<style>${STYLE}</style>
      <div class="box" part="box">
        <label>${field}<input id="shadow-input" name="shadow-name" /></label>
        <button id="shadow-save" type="button">${button}</button>
        <div class="out" id="shadow-out" role="status"></div>
      </div>`
    const input = root.querySelector('input') as HTMLInputElement
    root.querySelector('button')!.addEventListener('click', () => {
      ;(root.getElementById('shadow-out') as HTMLElement).textContent = `Saved in shadow: ${input.value}`
      emit(this, event, { name: input.value })
    })
  }
}

/** Closed shadow root: the root is not reachable via element.shadowRoot. */
class TpClosedCard extends HTMLElement {
  #count = 0
  connectedCallback() {
    if (this.dataset.ready) return
    this.dataset.ready = '1'
    const root = this.attachShadow({ mode: 'closed' })
    const label = this.getAttribute('button-label') ?? 'Closed action'
    root.innerHTML = `<style>${STYLE}</style>
      <div class="box"><button type="button">${label}</button><div class="out" role="status">Clicked 0 times</div></div>`
    const out = root.querySelector('.out') as HTMLElement
    root.querySelector('button')!.addEventListener('click', () => {
      this.#count += 1
      out.textContent = `Clicked ${this.#count} times`
      emit(this, 'tp-closed-action', { count: this.#count })
    })
  }
}

/** Inner host used inside another shadow root. */
class TpInnerPanel extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const button = this.getAttribute('button-label') ?? 'Apply nested'
    root.innerHTML = `<style>${STYLE}</style>
      <div class="box"><label>Nested value<input name="nested-value" /></label>
      <button type="button">${button}</button><div class="out" role="status"></div></div>`
    const input = root.querySelector('input') as HTMLInputElement
    root.querySelector('button')!.addEventListener('click', () => {
      ;(root.querySelector('.out') as HTMLElement).textContent = `Applied: ${input.value}`
      emit(this, 'tp-nested-apply', { value: input.value, depth: 2 })
    })
  }
}

/** Outer host whose shadow root contains another shadow host. */
class TpOuterPanel extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const inner = this.getAttribute('inner-button-label') ?? 'Apply nested'
    root.innerHTML = `<style>${STYLE}</style>
      <div class="box"><strong>Outer shadow root</strong>
      <tp-inner-panel button-label="${inner}"></tp-inner-panel></div>`
  }
}

/** Custom select: a trigger button inside the shadow root and slotted light-DOM options. */
class TpSelect extends HTMLElement {
  connectedCallback() {
    if (this.shadowRoot) return
    const root = this.attachShadow({ mode: 'open' })
    const label = this.getAttribute('label') ?? 'Colour'
    root.innerHTML = `<style>${STYLE}
        .list { border: 1px solid #b9c0d0; border-radius: 6px; padding: 4px; max-width: 220px; background: #fff; }
        .list[hidden] { display: none; }
        ::slotted(tp-option) { display: block; padding: 4px 8px; cursor: pointer; border-radius: 4px; }
        ::slotted(tp-option[aria-selected="true"]) { background: #e6ebff; }
      </style>
      <div class="box">
        <span id="lbl" style="font-weight:600;font-size:0.85rem">${label}</span><br/>
        <button type="button" aria-haspopup="listbox" aria-labelledby="lbl val" id="trigger"><span id="val">Choose…</span></button>
        <div class="list" role="listbox" aria-labelledby="lbl" hidden><slot></slot></div>
      </div>`
    const list = root.querySelector('.list') as HTMLElement
    const trigger = root.getElementById('trigger') as HTMLButtonElement
    const val = root.getElementById('val') as HTMLElement
    trigger.addEventListener('click', () => {
      list.hidden = !list.hidden
      trigger.setAttribute('aria-expanded', String(!list.hidden))
    })
    for (const opt of Array.from(this.querySelectorAll('tp-option'))) {
      opt.setAttribute('role', 'option')
      opt.setAttribute('aria-selected', 'false')
    }
    this.addEventListener('click', (e) => {
      const opt = (e.target as Element).closest?.('tp-option')
      if (!opt || !this.contains(opt)) return
      for (const o of Array.from(this.querySelectorAll('tp-option'))) o.setAttribute('aria-selected', String(o === opt))
      val.textContent = opt.textContent ?? ''
      list.hidden = true
      trigger.setAttribute('aria-expanded', 'false')
      this.setAttribute('value', opt.getAttribute('value') ?? '')
      emit(this, 'tp-select-change', { value: opt.getAttribute('value'), label: opt.textContent })
    })
  }
}

class TpOption extends HTMLElement {}

const DEFS: [string, CustomElementConstructor][] = [
  ['tp-open-card', TpOpenCard],
  ['tp-closed-card', TpClosedCard],
  ['tp-inner-panel', TpInnerPanel],
  ['tp-outer-panel', TpOuterPanel],
  ['tp-select', TpSelect],
  ['tp-option', TpOption],
]

/** Defines all elements that are not yet defined. Returns which were newly defined and which were skipped. */
export function defineShadowElements(): { defined: string[]; skipped: string[] } {
  const defined: string[] = []
  const skipped: string[] = []
  for (const [name, ctor] of DEFS) {
    if (customElements.get(name)) skipped.push(name)
    else {
      customElements.define(name, ctor)
      defined.push(name)
    }
  }
  return { defined, skipped }
}
