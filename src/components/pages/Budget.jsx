import QuarterPills from '../QuarterPills'
import MarketingBudget from '../MarketingBudget'

// Marketing Budget — its own view (moved out of the KPI Tracker per Margot, Jul
// 2026). Budget vs actual + spend by category & region, EUR-native.
export default function Budget() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">Marketing <span className="accent">Budget</span></div>
          <div className="page-sub">Budget vs actual · spend by category &amp; region · EUR · FY2026</div>
        </div>
        <QuarterPills />
      </div>
      <MarketingBudget />
    </>
  )
}
