// @vitest-environment jsdom
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'

afterEach(cleanup)
import EntryForm from './EntryForm'

vi.mock('../lib/supabase', () => ({ supabase: { auth: { getUser: vi.fn() } } }))
vi.mock('./VenuePicker', () => ({ default: () => null }))
vi.mock('./StarRating', () => ({ default: ({ value, onChange }) => (
  <button onClick={() => onChange(value)}>rating</button>
) }))

function idleAnalysis() {
  return { status: 'idle', suggestions: null, aiFields: new Set(), uploadResults: [], error: null }
}

function makePhoto(exifTimestamp = null) {
  return {
    id: 'p1',
    rawFile: new File(['x'], 'f.jpg'),
    previewUrl: 'blob:p1',
    exif: exifTimestamp ? { timestamp: exifTimestamp, lat: null, lng: null } : null
  }
}

function toDatetimeLocal(date) {
  const d = new Date(date)
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 16)
}

function makeProps(photos = []) {
  return {
    initialData: undefined,
    onSubmit: vi.fn(),
    submitLabel: 'Save entry',
    analysis: idleAnalysis(),
    photos,
    processing: false,
    processingError: null,
    onFilesAdded: vi.fn(),
    onPhotoRemoved: vi.fn(),
    onPhotoClear: vi.fn(),
  }
}

function getDateInput() {
  const inputs = document.querySelectorAll('input[type="datetime-local"]')
  if (inputs.length === 0) throw new Error('No datetime-local input found')
  return inputs[0]
}

describe('date auto-fill from EXIF', () => {
  it('fills date field with photo EXIF timestamp when photo is first added', () => {
    const exifTimestamp = new Date('2024-06-15T12:30:00Z').toISOString()

    render(<EntryForm {...makeProps([makePhoto(exifTimestamp)])} />)

    expect(getDateInput().value).toBe(toDatetimeLocal(exifTimestamp))
  })

  it('does not overwrite date if user has manually changed it before photo is added', () => {
    const exifTimestamp = new Date('2024-06-15T12:30:00Z').toISOString()
    const baseProps = makeProps([])
    const { rerender } = render(<EntryForm {...baseProps} />)

    const manualValue = '2024-07-01T09:45'
    fireEvent.change(getDateInput(), { target: { value: manualValue } })

    rerender(<EntryForm {...baseProps} photos={[makePhoto(exifTimestamp)]} />)

    expect(getDateInput().value).toBe(manualValue)
  })

  it('leaves date as current time when photo has no EXIF timestamp', () => {
    const now = Date.now()

    render(<EntryForm {...makeProps([makePhoto()])} />)

    const rendered = new Date(getDateInput().value).getTime()
    expect(Number.isNaN(rendered)).toBe(false)
    expect(Math.abs(rendered - now)).toBeLessThan(3 * 60 * 1000)
  })

  it('does not reset date when a second photo is added after first EXIF date was applied', () => {
    const exifTimestamp1 = new Date('2024-06-15T12:30:00Z').toISOString()
    const photo1 = makePhoto(exifTimestamp1)
    const baseProps = makeProps([photo1])
    const { rerender } = render(<EntryForm {...baseProps} />)

    const expected = toDatetimeLocal(exifTimestamp1)
    expect(getDateInput().value).toBe(expected)

    rerender(
      <EntryForm
        {...baseProps}
        photos={[
          photo1,
          { id: 'p2', rawFile: new File(['x'], 'f2.jpg'), previewUrl: 'blob:p2', exif: null },
        ]}
      />
    )

    expect(getDateInput().value).toBe(expected)
  })
})
