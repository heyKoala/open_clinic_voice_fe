import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DATE_PRESETS, rangeForPreset, type DatePreset, type ReportFilters } from '../lib/analytics'

const isPreset = (value: string | null): value is Exclude<DatePreset, 'custom'> =>
  DATE_PRESETS.some((p) => p.value === value)

/**
 * Report filters kept in the URL (?range=7d, or ?start=…&end=… for a custom range, plus ?direction=, ?language=
 * and ?doctor=), so opening a call and coming back keeps them, and a filtered view can be shared as a link.
 */
export function useReportFilters(defaultPreset: Exclude<DatePreset, 'custom'> = '7d') {
  const [params, setParams] = useSearchParams()

  const filters = useMemo<ReportFilters>(() => {
    const start = params.get('start')
    const end = params.get('end')
    const range = params.get('range')
    const dates = start && end
      ? { preset: 'custom' as const, start, end }
      : { preset: isPreset(range) ? range : defaultPreset, ...rangeForPreset(isPreset(range) ? range : defaultPreset) }
    const direction = params.get('direction')
    return {
      ...dates,
      direction: direction === 'inbound' || direction === 'outbound' ? direction : '',
      language: params.get('language') ?? '',
      doctor: params.get('doctor') ?? '',
    }
  }, [params, defaultPreset])

  const setFilters = useCallback((next: ReportFilters) => {
    const out: Record<string, string> = {}
    if (next.preset === 'custom') {
      out.start = next.start
      out.end = next.end
    } else if (next.preset !== defaultPreset) {
      out.range = next.preset
    }
    if (next.direction) out.direction = next.direction
    if (next.language) out.language = next.language
    if (next.doctor) out.doctor = next.doctor
    setParams(out, { replace: true })
  }, [setParams, defaultPreset])

  return [filters, setFilters] as const
}
