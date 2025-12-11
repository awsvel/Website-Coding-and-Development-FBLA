// add.js - loads Supabase UMD build and renders recent submissions

const SUPABASE_URL = 'https://rohkvcnzjyajmkiejlyx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJvaGt2Y256anlham1raWVqbHl4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUxNjUwNjMsImV4cCI6MjA4MDc0MTA2M30.WAint38ZBokMKABYz-klK3KzzECZ9WK4L9dxe7qAviA'
// Storage settings (set to the bucket you created)
const STORAGE_BUCKET = 'found item image'

// Load the UMD build of supabase-js to avoid ESM/browser resolver issues
function loadSupabaseUmd() {
  return new Promise((resolve, reject) => {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return resolve(window.supabase)
    }

    const s = document.createElement('script')
    // load the Supabase UMD bundle from CDN
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/dist/umd/supabase.min.js'
    s.crossOrigin = 'anonymous'
    s.onload = () => {
      if (window.supabase && typeof window.supabase.createClient === 'function') {
        resolve(window.supabase)
      } else {
        reject(new Error('Supabase UMD loaded but `window.supabase` missing'))
      }
    }
    s.onerror = (e) => reject(e)
    document.head.appendChild(s)
  })
}

function escapeHtml(unsafe) {
  return unsafe.replace(/[&<>"']/g, function (m) {
    switch (m) {
      case '&': return '&amp;'
      case '<': return '&lt;'
      case '>': return '&gt;'
      case '"': return '&quot;'
      case "'": return '&#039;'
      default: return m
    }
  })
}

function formatDateTime(val) {
  if (!val) return ''
  try {
    const d = new Date(val)
    if (!isNaN(d)) return d.toLocaleString()
  } catch (e) {}
  return String(val)
}


function renderRow(row, claimedTitles = []) {
  const card = document.createElement('div')
  card.className = 'item-card'

  // If an image URL is present, show it at the top of the card
  const imgUrl = row.image_url || row.image || row.image_path || row.thumbnail_url
  if (imgUrl) {
    const img = document.createElement('img')
    img.className = 'card-thumb'
    img.src = imgUrl
    img.alt = String(row.title || row.item || row.item_name || 'Found item')
    card.appendChild(img)
  }

  const preferred = ['item_name', 'name', 'title', 'item', 'description']
  let headingKey = preferred.find(k => k in row && row[k])
  let headingText = ''

  if (!headingKey) {
    headingKey = Object.keys(row).find(
      k => k !== 'id' && k !== 'created_at' && row[k] !== null && row[k] !== undefined
    )
  }

  if (headingKey) {
    headingText = String(row[headingKey])
    const h = document.createElement('h3')
    h.textContent = headingText
    card.appendChild(h)
  }

  // Explicitly render common fields with consistent friendly labels
  // Submitted (created_at)
  if (row.created_at) {
    const submittedVal = formatDateTime(row.created_at) || String(row.created_at || '')
    const pDate = document.createElement('p')
    pDate.innerHTML = `<strong>Submitted:</strong> ${escapeHtml(submittedVal)}`
    card.appendChild(pDate)
  }

  // Found on (found_date)
  if (row.found_date) {
    const foundVal = formatDateTime(row.found_date) || String(row.found_date || '')
    const pFound = document.createElement('p')
    pFound.innerHTML = `<strong>Found on:</strong> ${escapeHtml(foundVal)}`
    card.appendChild(pFound)
  }

  // Location found
  if (row.location) {
    const pLoc = document.createElement('p')
    pLoc.innerHTML = `<strong>Location found:</strong> ${escapeHtml(String(row.location))}`
    card.appendChild(pLoc)
  }

  // Details (description)
  if (row.description) {
    const pDesc = document.createElement('p')
    pDesc.innerHTML = `<strong>Details:</strong> ${escapeHtml(String(row.description))}`
    card.appendChild(pDesc)
  }

  const keys = Object.keys(row).filter(
    k =>
      k !== 'id' &&
      k !== 'created_at' &&
      k !== 'approved' &&
      k !== headingKey &&
      k !== 'found_date' &&
      k !== 'location' &&
      k !== 'description' &&
      k !== 'image_url' &&
      k !== 'image_path' &&
      k !== 'thumbnail_url' &&
      k !== 'image'
  )

  keys.forEach(key => {
    const value = row[key]
    if (value === null || value === undefined || String(value).trim() === '') return

    const lowKey = String(key).toLowerCase()

    const p = document.createElement('p')
    p.innerHTML = `<strong>${escapeHtml(key.replace(/_/g, ' '))}:</strong> ${escapeHtml(String(value))}`
    card.appendChild(p)
  })
  return card
}

// RECENT SUBMISSIONS on homepage

async function loadRecentSubmissions() {
  const listEl = document.getElementById('recent-list')
  const moreItemsSection = document.getElementById('more-items-section')
  if (!listEl) return

  listEl.innerHTML = '<div class="message">Loading...</div>'

  try {
    const supabaseModule = await loadSupabaseUmd()
    const client = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data, error } = await client
      .from('found_items')
      .select('*')
      // newest first
      .order('id', { ascending: false })

    if (error) {
      listEl.innerHTML = `<div class="message error">Error loading submissions: ${escapeHtml(error.message || String(error))}</div>`
      console.error(error)
      return
    }

    if (!data || data.length === 0) {
      listEl.innerHTML = '<div class="message">No submissions found.</div>'
      return
    }

    listEl.innerHTML = ''

// Read claimed titles from localStorage (if any)
let claimedTitles = []
try {
  const stored = localStorage.getItem('claimedItemTitles')
  if (stored) {
    const parsed = JSON.parse(stored)
    if (Array.isArray(parsed)) claimedTitles = parsed
  }
} catch (e) {
  console.error('Error reading claimed titles from localStorage', e)
}

// Limit to 3 items on homepage
const displayedItems = data.slice(0, 3)

    displayedItems.forEach(row => {
      const card = renderRow(row, claimedTitles)
      // Add click handler to open modal — pass id + title for robust prefill
      card.style.cursor = 'pointer'
      const titleForModal = row.title || row.item || row.item_name || ''
      card.addEventListener('click', () => {
        openItemActionModal(row.id, titleForModal)
      })
      listEl.appendChild(card)
    })

// Always show the "more items" section (button) if it exists
if (moreItemsSection) {
  moreItemsSection.style.display = ''
}

  } catch (err) {
    listEl.innerHTML = `<div class="message error">Error loading Supabase library: ${escapeHtml(err.message || String(err))}</div>`
    console.error(err)
  }
}

function openItemActionModal(itemId, itemTitle) {
  const modal = document.getElementById('item-action-modal')
  const titleEl = document.getElementById('modal-item-title')
  const claimBtn = document.getElementById('modal-claim-btn')
  const inquireBtn = document.getElementById('modal-inquire-btn')
  const closeBtn = document.getElementById('modal-close-btn')

  if (!modal) return

  titleEl.textContent = itemTitle || ''
  modal.classList.add('active')

  const handleClaim = () => {
    modal.classList.remove('active')
    // Store ID for robust prefill, and store title for display
    try { sessionStorage.setItem('selectedItemId', String(itemId || '')) } catch (e) {}
    try { sessionStorage.setItem('selectedItemForClaim', itemTitle || '') } catch (e) {}
    sessionStorage.setItem('inquiryType', 'claim')
    window.location.href = 'claimform.html'
  }

  const handleInquire = () => {
    modal.classList.remove('active')
    try { sessionStorage.setItem('selectedItemId', String(itemId || '')) } catch (e) {}
    try { sessionStorage.setItem('selectedItemForClaim', itemTitle || '') } catch (e) {}
    sessionStorage.setItem('inquiryType', 'inquire')
    window.location.href = 'claimform.html'
  }

  const handleClose = () => {
    modal.classList.remove('active')
    claimBtn.removeEventListener('click', handleClaim)
    inquireBtn.removeEventListener('click', handleInquire)
    closeBtn.removeEventListener('click', handleClose)
  }

  // clear previous handlers to avoid duplicates
  claimBtn.replaceWith(claimBtn.cloneNode(true))
  inquireBtn.replaceWith(inquireBtn.cloneNode(true))
  closeBtn.replaceWith(closeBtn.cloneNode(true))

  // re-query nodes after replace
  const nClaim = document.getElementById('modal-claim-btn')
  const nInquire = document.getElementById('modal-inquire-btn')
  const nClose = document.getElementById('modal-close-btn')

  nClaim.addEventListener('click', handleClaim)
  nInquire.addEventListener('click', handleInquire)
  nClose.addEventListener('click', handleClose)
}

document.addEventListener('DOMContentLoaded', loadRecentSubmissions)

// Close modal on background click
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('item-action-modal')
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.classList.remove('active')
      }
    })
  }
})


// form for lost items

document.addEventListener('DOMContentLoaded', () => {
  const foundForm = document.getElementById('found-form')
  if (!foundForm) return // not on lost.html

  const itemInput = document.getElementById('item')
  const descriptionInput = document.getElementById('description')
  const locationInput = document.getElementById('location')
  const dateFoundInput = document.getElementById('dateFound')
  const formMessage = document.getElementById('form-message')

  foundForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    const fileInput = document.getElementById('item-image')
    const file = fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0] : null

    const data = {
      item: itemInput.value.trim(),
      description: descriptionInput.value.trim(),
      location: locationInput.value.trim(),
      dateFound: dateFoundInput.value
    }

    // sanity check
    if (!data.item || !data.description || !data.location || !data.dateFound) {
      if (formMessage) {
        formMessage.textContent = 'Please fill in all fields before submitting.'
        formMessage.style.color = 'red'
      }
      return
    }

    try {
      if (file) {
        if (formMessage) {
          formMessage.textContent = 'Uploading image...'
          formMessage.style.color = ''
        }

        const supabaseModule = await loadSupabaseUmd()
        const client = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        const ext = (file.name || '').split('.').pop() || 'jpg'
        const filename = `found-${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`
        const path = filename

        const { error: uploadErr } = await client.storage.from(STORAGE_BUCKET).upload(path, file)
        if (uploadErr) {
          console.error('Image upload error', uploadErr)
          if (formMessage) {
            formMessage.textContent = 'Image upload failed: ' + (uploadErr.message || String(uploadErr))
            formMessage.style.color = 'red'
          }
          return
        }

        // Construct public URL for uploaded object (public bucket assumed)
        // encode bucket and path to be safe when names contain spaces or special chars
        const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${encodeURIComponent(STORAGE_BUCKET)}/${encodeURIComponent(path)}`
        data.image_url = publicUrl
        data.image_path = path
      }

      // store temporarily for admin approval in an array (support multiple pending items)
      let pending = []
      try {
        const raw = sessionStorage.getItem('pendingFoundItems')
        if (raw) pending = JSON.parse(raw)
      } catch (e) {
        console.warn('Error parsing pending items', e)
      }
      pending.push(data)
      sessionStorage.setItem('pendingFoundItems', JSON.stringify(pending))

      // show a friendly confirmation to the submitter and reset the form
      if (formMessage) {
        formMessage.textContent = 'Thanks — your submission has been saved and is awaiting admin approval.'
        formMessage.style.color = 'green'
      }
      foundForm.reset()
    } catch (err) {
      console.error('Error handling submission', err)
      if (formMessage) {
        formMessage.textContent = 'Error submitting item: ' + (err.message || String(err))
        formMessage.style.color = 'red'
      }
    }
  })
})


// SUPABASE APPROVAL PAGE

document.addEventListener('DOMContentLoaded', () => {
  const pendingContainer = document.getElementById('pending-items')
  const noItems = document.getElementById('no-items')

  if (!pendingContainer) return // not on approve.html

  let pending = []
  try {
    const raw = sessionStorage.getItem('pendingFoundItems')
    if (raw) pending = JSON.parse(raw)
  } catch (e) {
    console.warn('Error parsing pending items', e)
  }

  if (!pending || pending.length === 0) {
    // nothing waiting for approval
    pendingContainer.style.display = 'none'
    if (noItems) noItems.style.display = 'block'
    return
  }

  // Render all pending items with individual approve/cancel buttons
  pendingContainer.innerHTML = ''
  pending.forEach((data, index) => {
    const card = document.createElement('div')
    card.className = 'item-card'
    card.innerHTML = `
      ${data.image_url ? `<img class="card-thumb" src="${escapeHtml(data.image_url)}" alt="${escapeHtml(data.item || '')}" />
      <div style="margin-bottom:8px;"><button class="view-image-btn" data-index="${index}" class="btn outline">View Image</button></div>` : ''}
      <h3>${escapeHtml(data.item || '')}</h3>
      <p><strong>Submitted:</strong> ${escapeHtml(formatDateTime(data.created_at) || '')}</p>
      <p><strong>Found on:</strong> ${escapeHtml(data.dateFound || '')}</p>
      <p><strong>Location found:</strong> ${escapeHtml(data.location || '')}</p>
      <p><strong>Details:</strong> ${escapeHtml(data.description || '')}</p>
      <div class="admin-buttons">
        <button class="approve-btn" data-index="${index}" class="btn primary">Approve & Save</button>
        <button class="cancel-btn" data-index="${index}" class="btn outline">Cancel</button>
      </div>
      <div class="approve-message" data-index="${index}" class="message" aria-live="polite"></div>
    `
    pendingContainer.appendChild(card)
  })

  // Attach handlers to all pending items
  pendingContainer.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10)
      pending.splice(idx, 1)
      if (pending.length === 0) {
        sessionStorage.removeItem('pendingFoundItems')
        pendingContainer.style.display = 'none'
        if (noItems) noItems.style.display = 'block'
      } else {
        sessionStorage.setItem('pendingFoundItems', JSON.stringify(pending))
        // Re-render to update indices
        location.reload()
      }
    })
  })

  // Attach image view handlers
  pendingContainer.querySelectorAll('.view-image-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10)
      const item = pending[idx]
      if (item && item.image_url) {
        try {
          window.open(item.image_url, '_blank')
        } catch (e) { console.error('Error opening image', e) }
      }
    })
  })

  // Attach handlers to all approve buttons
  pendingContainer.querySelectorAll('.approve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = parseInt(btn.getAttribute('data-index'), 10)
      const data = pending[idx]
      const msgEl = pendingContainer.querySelector(`.approve-message[data-index="${idx}"]`)

      if (msgEl) msgEl.textContent = 'Saving to database...'

      try {
        const supabaseModule = await loadSupabaseUmd()
        const client = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        // Insert into found_items table (map pending data to table columns)
        try {
          const insertRow = {
            title: data.item || null,
            description: data.description || null,
            location: data.location || null,
            found_date: data.dateFound || null
          }

          // include image fields if available
          if (data.image_url) insertRow.image_url = data.image_url
          if (data.image_path) insertRow.image_path = data.image_path
          const { data: inserted, error: insertErr } = await client.from('found_items').insert([insertRow])
          if (insertErr) {
            console.error('Insert error:', insertErr)
            if (msgEl) msgEl.textContent = 'Error saving item: ' + (insertErr.message || String(insertErr))
            return
          }

          // success: remove this item from pending and re-render
          console.log('Item inserted successfully', inserted)
          pending.splice(idx, 1)
          if (pending.length === 0) {
            sessionStorage.removeItem('pendingFoundItems')
            pendingContainer.style.display = 'none'
            if (noItems) noItems.style.display = 'block'
          } else {
            sessionStorage.setItem('pendingFoundItems', JSON.stringify(pending))
            // Re-render to update indices
            location.reload()
          }
        } catch (insErr) {
          console.error('Unexpected insert error', insErr)
          if (msgEl) msgEl.textContent = 'Error saving item: ' + (insErr.message || String(insErr))
        }

      } catch (err) {
        console.error(err)
        if (msgEl) msgEl.textContent = 'Error loading Supabase: ' + (err.message || String(err))
      }
    })
  })
})


// ADMIN LOGIN

const form = document.getElementById('admin-login-form')
const usernameInput = document.getElementById('username')
const passwordInput = document.getElementById('password')
const message = document.getElementById('login-message')

if (!form) {
  // fine, we're just not on the login page
} else {
  form.addEventListener('submit', function (e) {
    e.preventDefault()

    const username = usernameInput.value.trim()
    const password = passwordInput.value.trim()

    message.textContent = ''
    message.style.color = ''

    if (username === 'admin' && password === 'admin') {
      window.location.href = 'managelost.html'
    } else {
      message.textContent = 'Incorrect username or password.'
      message.style.color = 'red'
    }
  })
}
// SEARCH + CLAIM FORM + SEARCH

document.addEventListener('DOMContentLoaded', () => {
  const claimGrid = document.getElementById('claim-items-grid')
  const claimForm = document.getElementById('claim-form')
  const claimSearch = document.getElementById('claim-search-input')
  const claimNextBtn = document.getElementById('claim-next-btn')
  const claimDetails = document.getElementById('claim-details')

  if (!claimGrid || !claimNextBtn || !claimSearch) return // not on claimform.html

  let items = []
  let selectedTitle = ''
  let selectedId = ''

  function renderClaimItems(list) {
    claimGrid.innerHTML = ''
    if (!list || list.length === 0) {
      claimGrid.innerHTML = '<div class="message">No items available.</div>'
      return
    }

    list.forEach(row => {
      const div = document.createElement('div')
      div.className = 'claim-card'
      div.tabIndex = 0
      div.setAttribute('data-id', String(row.id || ''))
      div.setAttribute('data-title', row.title || '')
      div.innerHTML = `
        ${row.image_url ? `<img class="card-thumb" src="${escapeHtml(row.image_url)}" alt="${escapeHtml(row.title || '')}" />` : ''}
        <h4>${escapeHtml(row.title || '')}</h4>
        <p>${escapeHtml((row.description || '').slice(0, 120))}</p>
        <p style="font-size:0.85rem;color:var(--muted);">${escapeHtml(row.location || '')}</p>
      `

      div.addEventListener('click', () => {
        // clear previous selection
        const prev = claimGrid.querySelector('.claim-card.selected')
        if (prev) prev.classList.remove('selected')

        div.classList.add('selected')
        const selId = String(div.getAttribute('data-id') || '')
        selectedTitle = String(div.getAttribute('data-title') || '')
        selectedId = selId

        // Immediately fill the selected item input and show details (no next press required)
        const itemInput = document.getElementById('claim-item-name')
        if (itemInput) itemInput.value = selectedTitle

        // If user selected from homepage preselection, set inquiry type accordingly
        const preselectedInquiry = sessionStorage.getItem('inquiryType')
        if (preselectedInquiry) {
          const typeInput = document.querySelector(`input[name="inquiry_type"][value="${preselectedInquiry}"]`)
          if (typeInput) typeInput.checked = true
          sessionStorage.removeItem('inquiryType')
        }

        // show form and inquiry textarea toggle
        if (document.getElementById('claim-details')) {
          document.getElementById('claim-details').style.display = ''
          const inquiryTextField = document.getElementById('inquiry-text-field')
          const checked = document.querySelector('input[name="inquiry_type"]:checked')
          if (inquiryTextField) inquiryTextField.style.display = (checked && checked.value === 'inquire') ? '' : 'none'
          // scroll into view
          document.getElementById('claim-details').scrollIntoView({ behavior: 'smooth' })
        }
      })

      div.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          div.click()
        }
      })

      claimGrid.appendChild(div)
    })
  }

  async function loadClaimItems() {
    try {
        const supabaseModule = await loadSupabaseUmd()
        const client = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        const { data, error } = await client.from('found_items').select('id,title,description,location,found_date,image_url,image_path').order('id', { ascending: false })
      if (error) {
        claimGrid.innerHTML = `<div class="message error">Error loading items: ${escapeHtml(error.message || String(error))}</div>`
        console.error(error)
        return
      }

      items = data || []
      renderClaimItems(items)
    } catch (err) {
      claimGrid.innerHTML = `<div class="message error">Error loading items: ${escapeHtml(err.message || String(err))}</div>`
      console.error(err)
    }
  }

  claimSearch.addEventListener('input', (e) => {
    const q = String(e.target.value || '').toLowerCase().trim()
    if (!q) {
      renderClaimItems(items)
      return
    }

    const filtered = items.filter(r => {
      const t = String(r.title || '').toLowerCase()
      const d = String(r.description || '').toLowerCase()
      const l = String(r.location || '').toLowerCase()
      return t.includes(q) || d.includes(q) || l.includes(q)
    })
    renderClaimItems(filtered)
  })

  claimNextBtn.addEventListener('click', () => {
    if (!selectedTitle) return
    // show details form and prefill selected item
    const itemInput = document.getElementById('claim-item-name')
    if (itemInput) itemInput.value = selectedTitle
    
    // Check if user came from homepage with pre-selected item + inquiry type
    const preselectedInquiry = sessionStorage.getItem('inquiryType')
    if (preselectedInquiry) {
      const typeInput = document.querySelector(`input[name="inquiry_type"][value="${preselectedInquiry}"]`)
      if (typeInput) typeInput.checked = true
      sessionStorage.removeItem('inquiryType')
    }
    
    claimDetails.style.display = ''
    // scroll to form
    claimDetails.scrollIntoView({ behavior: 'smooth' })
  })

    // Show/hide inquiry textarea when user toggles inquiry type
    const inquiryTextField = document.getElementById('inquiry-text-field')
    const typeRadios = document.querySelectorAll('input[name="inquiry_type"]')
    if (typeRadios && typeRadios.length > 0) {
      typeRadios.forEach(r => r.addEventListener('change', (e) => {
        const v = e.target.value
        if (inquiryTextField) inquiryTextField.style.display = (v === 'inquire') ? '' : 'none'
      }))
    }

  // Load pre-selected item from homepage (by ID) if available
  document.addEventListener('DOMContentLoaded', () => {
    const preselectedId = sessionStorage.getItem('selectedItemId')
    const preselectedTitle = sessionStorage.getItem('selectedItemForClaim')
    if (preselectedId) {
      // Wait for items to load, then select the pre-selected one by ID
      const checkAndSelect = () => {
        const card = claimGrid.querySelector(`[data-id="${preselectedId}"]`)
        if (card) {
          card.click()
          // Trigger Next automatically
          claimNextBtn.click()
          sessionStorage.removeItem('selectedItemId')
          sessionStorage.removeItem('selectedItemForClaim')
        } else if (items.length > 0) {
          // If items loaded but not found, prefill the input with the title if available
          if (preselectedTitle) {
            const itemInput = document.getElementById('claim-item-name')
            if (itemInput) itemInput.value = preselectedTitle
          }
          claimNextBtn.click()
          sessionStorage.removeItem('selectedItemId')
          sessionStorage.removeItem('selectedItemForClaim')
        } else {
          // try again shortly
          setTimeout(checkAndSelect, 300)
        }
      }
      setTimeout(checkAndSelect, 400)
    }
  }, { once: true })

  // Submit handler for details form
  if (claimForm) {
    claimForm.addEventListener('submit', async (e) => {
      e.preventDefault()

      const itemInput = document.getElementById('claim-item-name')
      const nameInput = document.getElementById('claim-name')
      const emailInput = document.getElementById('claim-email')
      const inquiryTypeInput = document.querySelector('input[name="inquiry_type"]:checked')

      const itemName = itemInput.value.trim()
      const claimantName = nameInput.value.trim()
      const email = emailInput.value.trim()
      const inquiryType = inquiryTypeInput ? inquiryTypeInput.value : 'claim'

      if (!itemName || !claimantName || !email) {
        alert('Please fill in all fields.')
        return
      }

      try {
        const supabaseModule = await loadSupabaseUmd()
        const client = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        const inquiryTextEl = document.getElementById('claim-inquiry')
        const inquiryText = inquiryTextEl ? inquiryTextEl.value.trim() : ''
        const claimingFlag = inquiryType === 'claim'

        const { error: insertError } = await client.from('claims').insert([{
          item_name: itemName,
          name: claimantName,
          email: email,
          claiming: claimingFlag,
          inquiry: inquiryText || null
        }])

        if (insertError) {
          console.error(insertError)
          alert('Error saving submission: ' + (insertError.message || String(insertError)))
          return
        }

        // Mark matching titles in localStorage for index highlighting (for claims only)
        if (inquiryType === 'claim') {
          const { data: foundItems, error: foundError } = await client.from('found_items').select('title')
          if (foundError) {
            console.error(foundError)
            alert('Submission saved, but error checking items: ' + (foundError.message || String(foundError)))
          } else {
            const normalizedClaim = itemName.toLowerCase()
            const matchingTitles = (foundItems || []).map(r => r.title || '').filter(t => t && t.toLowerCase() === normalizedClaim)

            if (matchingTitles.length > 0) {
              let current = []
              try {
                const existing = localStorage.getItem('claimedItemTitles')
                if (existing) {
                  const parsed = JSON.parse(existing)
                  if (Array.isArray(parsed)) current = parsed
                }
              } catch (e2) {
                console.error('Error parsing existing claimed titles', e2)
              }

              const merged = Array.from(new Set([
                ...current,
                ...matchingTitles.map(t => t.toLowerCase())
              ]))

              localStorage.setItem('claimedItemTitles', JSON.stringify(merged))
            }
          }
        }

        const claimMsgEl = document.getElementById('claim-message')
        if (claimMsgEl) {
          claimMsgEl.textContent = 'Thanks — your request has been received and is awaiting a reply from the finder.'
          claimMsgEl.style.color = 'green'
        }
        claimForm.reset()
        // reset selection UI
        const prev = claimGrid.querySelector('.claim-card.selected')
        if (prev) prev.classList.remove('selected')
        selectedTitle = ''
        claimNextBtn.disabled = true
        claimSearch.value = ''
        claimDetails.style.display = 'none'
        renderClaimItems(items)

      } catch (err) {
        console.error(err)
        alert('Unexpected error: ' + (err.message || String(err)))
      }
    })
  }

  loadClaimItems()

})


// ADMIN INQUIRY + CLAIMS MANAGEMENT (simplified)
document.addEventListener('DOMContentLoaded', () => {
  const tabInquiries = document.getElementById('tab-inquiries')
  const tabClaims = document.getElementById('tab-claims')
  const inquiriesList = document.getElementById('inquiries-list')
  const claimsList = document.getElementById('claims-list')
  const claimedList = document.getElementById('claimed-list')

  if (!inquiriesList && !claimsList && !claimedList) return // not on any admin requests page

  function showInquiries() {
    if (inquiriesList) inquiriesList.style.display = ''
    if (claimsList) claimsList.style.display = 'none'
  }
  function showClaims() {
    if (inquiriesList) inquiriesList.style.display = 'none'
    if (claimsList) claimsList.style.display = ''
  }
  if (tabInquiries) tabInquiries.addEventListener('click', showInquiries)
  if (tabClaims) tabClaims.addEventListener('click', showClaims)

  async function loadRequests() {
    try {
      const supabaseModule = await loadSupabaseUmd()
      const client = supabaseModule.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

      const { data, error } = await client.from('claims').select('*').order('id', { ascending: false })
      if (error) {
        if (inquiriesList) inquiriesList.innerHTML = `<div class="message error">Error loading requests: ${escapeHtml(error.message || String(error))}</div>`
        if (claimsList) claimsList.innerHTML = ''
        console.error(error)
        return
      }

      const inquiries = (data || []).filter(r => r.claiming === false && (!r.status || (r.status !== 'approved' && r.status !== 'denied')))
      const claims = (data || []).filter(r => r.claiming === true && (!r.status || (r.status !== 'approved' && r.status !== 'denied')))
      const resolved = (data || []).filter(r => r.status === 'approved' || r.status === 'denied')

      // Update admin counts if these elements exist on the page
      try {
        const approvalsEl = document.getElementById('approvals-count')
        const inquiriesEl = document.getElementById('inquiries-count')
        const claimsEl = document.getElementById('claims-count')
        let approvalsCount = 0
        try {
          const rawPending = sessionStorage.getItem('pendingFoundItems')
          if (rawPending) {
            const parsed = JSON.parse(rawPending)
            approvalsCount = Array.isArray(parsed) ? parsed.length : 0
          }
        } catch (e) { console.warn('Error counting pending', e) }
        if (approvalsEl) approvalsEl.textContent = String(approvalsCount)
        if (inquiriesEl) inquiriesEl.textContent = String(inquiries.length || 0)
        if (claimsEl) claimsEl.textContent = String(claims.length || 0)
      } catch (e) {
        console.error('Error updating admin counts', e)
      }

      // Render inquiries (managelost.html)
      if (inquiriesList) {
        if (inquiries.length === 0) {
          inquiriesList.innerHTML = '<div class="message">No inquiries.</div>'
        } else {
          inquiriesList.innerHTML = ''
          inquiries.forEach(entry => {
            const div = document.createElement('div')
            div.className = 'item-card'
            div.innerHTML = `
              <h3>${escapeHtml(entry.item_name || '')}</h3>
              <p><strong>Submitted:</strong> ${escapeHtml(formatDateTime(entry.created_at) || '')}</p>
              <p><strong>From:</strong> ${escapeHtml(entry.name || '')} &lt;${escapeHtml(entry.email || '')}&gt;</p>
              <p><strong>Details:</strong> ${escapeHtml(entry.inquiry || '')}</p>
              <div class="admin-buttons">
                <button class="btn primary resolve-inquiry" data-id="${entry.id}">Resolve (delete)</button>
              </div>
            `
            inquiriesList.appendChild(div)
          })
        }
      }

      // Render claims (admin_claims.html)
      if (claimsList) {
        if (claims.length === 0) {
          claimsList.innerHTML = '<div class="message">No claims.</div>'
        } else {
          claimsList.innerHTML = ''
          claims.forEach(entry => {
            const div = document.createElement('div')
            div.className = 'item-card'
            div.innerHTML = `
              <h3>${escapeHtml(entry.item_name || '')}</h3>
              <p><strong>Submitted:</strong> ${escapeHtml(formatDateTime(entry.created_at) || '')}</p>
              <p><strong>From:</strong> ${escapeHtml(entry.name || '')} &lt;${escapeHtml(entry.email || '')}&gt;</p>
              <div class="admin-buttons">
                <button class="btn primary approve-claim" data-id="${entry.id}" data-item="${escapeHtml(entry.item_name || '')}" data-name="${escapeHtml(entry.name || '')}" data-email="${escapeHtml(entry.email || '')}">Approve (archive & remove)</button>
                <button class="btn outline deny-claim" data-id="${entry.id}" data-item="${escapeHtml(entry.item_name || '')}">Deny (return to found)</button>
              </div>
            `
            claimsList.appendChild(div)
          })
        }
      }

      // Render resolved/archived list (if present)
      if (claimedList) {
        try {
          const { data: claimedData, error: claimedErr } = await client.from('claimed_items').select('*').order('id', { ascending: true })
          if (claimedErr) {
            claimedList.innerHTML = `<div class="message error">Error loading claimed items: ${escapeHtml(claimedErr.message || String(claimedErr))}</div>`
          } else if (!claimedData || claimedData.length === 0) {
            claimedList.innerHTML = '<div class="message">No claimed items found.</div>'
          } else {
            claimedList.innerHTML = ''
            claimedData.forEach(ci => {
              const d = document.createElement('div')
              d.className = 'item-card'
              d.innerHTML = `
                  <h3>${escapeHtml(ci.title || '')}</h3>
                  <p><strong>From:</strong> ${escapeHtml(ci.claimant_name || '')} &lt;${escapeHtml(ci.claimant_email || '')}&gt;</p>
                  <p><strong>Resolved:</strong> ${escapeHtml(formatDateTime(ci.resolved_at || ci.created_at || ''))}</p>
                `
              claimedList.appendChild(d)
            })
          }
        } catch (err) {
          claimedList.innerHTML = `<div class="message error">Error loading claimed items: ${escapeHtml(err.message || String(err))}</div>`
        }
      }

      // Attach handlers for admin actions
      // Approve claim: set status='approved', archive into claimed_items, remove from found_items
      if (claimsList) {
        claimsList.querySelectorAll('.approve-claim').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id')
            const itemName = btn.getAttribute('data-item')
            const claimantName = btn.getAttribute('data-name')
            const claimantEmail = btn.getAttribute('data-email')
            if (!confirm('Approve claim? This will archive the item and remove it from the found items listing.')) return

            try {
              // update claim status
              const { error: upErr } = await client.from('claims').update({ status: 'approved' }).eq('id', id)
              if (upErr) { alert('Error updating claim status: ' + (upErr.message || String(upErr))); console.error(upErr); return }

              // archive
              try {
                await client.from('claimed_items').insert([{
                  title: itemName,
                  claimant_name: claimantName || null,
                  claimant_email: claimantEmail || null,
                  resolved_at: new Date().toISOString()
                }])
              } catch (archiveErr) { console.warn('Archive error', archiveErr) }

              // remove from found_items
              try {
                const { error: delErr } = await client.from('found_items').delete().eq('title', itemName)
                if (delErr) console.warn('Error removing found item:', delErr)
              } catch (e) { console.error('Error deleting found_items entry', e) }

              alert('Claim approved and archived.')
              loadRequests()
            } catch (err) {
              console.error(err)
              alert('Unexpected error approving claim: ' + (err.message || String(err)))
            }
          })
        })

        // Deny claim: set status='denied' and ensure the item exists in found_items
        claimsList.querySelectorAll('.deny-claim').forEach(btn => {
          btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id')
            const itemName = btn.getAttribute('data-item')
            if (!confirm('Deny this claim? This will mark the claim as denied and ensure the item is available in the found listings.')) return

            try {
              const { error: upErr } = await client.from('claims').update({ status: 'denied' }).eq('id', id)
              if (upErr) { alert('Error updating claim status: ' + (upErr.message || String(upErr))); console.error(upErr); return }

              // Ensure the found_items row exists (insert minimal record if missing)
              try {
                const { data: existing } = await client.from('found_items').select('id').eq('title', itemName).limit(1)
                if (!existing || existing.length === 0) {
                  try {
                    await client.from('found_items').insert([{ title: itemName }])
                  } catch (insErr) {
                    console.warn('Could not re-insert found_items row:', insErr)
                  }
                }
              } catch (selErr) {
                console.warn('Error ensuring found_items exists:', selErr)
              }

              alert('Claim denied and item returned to found listings (if needed).')
              loadRequests()
            } catch (err) {
              console.error(err)
              alert('Unexpected error denying claim: ' + (err.message || String(err)))
            }
          })
        })
      }

      // Attach handlers for inquiries (delete)
      if (inquiriesList) {
        inquiriesList.querySelectorAll('.resolve-inquiry').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const id = btn.getAttribute('data-id')
            if (!confirm('Resolve inquiry? Make sure you have replied to the user by email before resolving. This will DELETE the inquiry.')) return
            try {
              const { error } = await client.from('claims').delete().eq('id', id)
              if (error) { alert('Error resolving inquiry: ' + (error.message || String(error))); console.error(error); return }
              alert('Inquiry resolved and deleted.')
              loadRequests()
            } catch (err) {
              console.error(err)
              alert('Unexpected error resolving inquiry: ' + (err.message || String(err)))
            }
          })
        })
      }

    } catch (err) {
      console.error(err)
      if (inquiriesList) inquiriesList.innerHTML = `<div class="message error">Error loading requests: ${escapeHtml(err.message || String(err))}</div>`
      if (claimsList) claimsList.innerHTML = `<div class="message error">Error loading requests: ${escapeHtml(err.message || String(err))}</div>`
    }
  }

  // Initial load
  if (tabInquiries) showInquiries()
  loadRequests()

})