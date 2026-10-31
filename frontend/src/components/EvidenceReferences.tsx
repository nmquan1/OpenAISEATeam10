import type { RetrievalResult } from '@market-maker/contracts/evidence';

export function EvidenceReferences({ result }: { result: RetrievalResult }) {
  if (result.status === 'disabled') return null;
  return (
    <div className="reference-evidence" data-testid="reference-evidence">
      <p className="notice">
        Reference lịch sử nước ngoài / mô phỏng giả định. Không phải dữ liệu của shop, không chứng
        minh uplift và không tự thay CVR, ngân sách hay mức tiền VND.
      </p>
      {result.status === 'unavailable' && (
        <p role="status">Gói reference chưa sẵn sàng. AI vẫn có thể đề xuất từ thiết lập shop.</p>
      )}
      {result.status === 'no_match' && (
        <p role="status">Không có reference phù hợp. AI sẽ không có evidence từ truy vấn này.</p>
      )}
      {result.status === 'matched' && (
        <>
          <p>
            {result.items.length} reference phù hợp · {result.dataset_version}
          </p>
          {result.items.map((item) => (
            <details key={item.evidence_id} className="reference-card">
              <summary>{item.label}</summary>
              <p>{item.summary}</p>
              <p className="hint">
                {item.source_dataset} · {item.entity_type} · {item.money_unit} · {item.amount_basis}
              </p>
              <p className="hint">
                Phạm vi: {item.evidence_scope} · Thời gian: {item.time_basis}
              </p>
              <p className="hint">
                Mẫu số:{' '}
                {Object.entries(item.population)
                  .map(([label, value]) => `${label}: ${value.toLocaleString('vi-VN')}`)
                  .join(' · ')}
              </p>
              <a href={item.source_url} target="_blank" rel="noreferrer">
                Nguồn dữ liệu
              </a>
              <details>
                <summary>Số liệu và giới hạn áp dụng</summary>
                <div
                  className="table-scroll"
                  tabIndex={0}
                  role="region"
                  aria-label={`Số liệu ${item.label}`}
                >
                  <table>
                    <caption className="sr-only">Số liệu nguyên bản và đơn vị nguồn</caption>
                    <tbody>
                      {Object.entries(item.metrics).map(([label, value]) => (
                        <tr key={label}>
                          <th scope="row">{label}</th>
                          <td>{value === null ? 'Chưa có số liệu' : String(value)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <ul>
                  {item.limitations.map((limitation) => (
                    <li key={limitation}>{limitation}</li>
                  ))}
                </ul>
              </details>
              <p className="hint">
                Evidence ID: <code>{item.evidence_id}</code>
              </p>
            </details>
          ))}
        </>
      )}
    </div>
  );
}
