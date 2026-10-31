import { useEffect, useRef } from 'react';

const sections = [
  { id: 'guide-overview', label: 'Công cụ làm gì' },
  { id: 'guide-input', label: '1 · Nhập số liệu' },
  { id: 'guide-results', label: '2 · Đọc kết quả' },
  { id: 'guide-ai', label: '3 · Nhờ AI' },
  { id: 'guide-terms', label: 'Thuật ngữ' },
  { id: 'guide-limits', label: 'Lưu ý' },
];

/** In-app user guide, shown in a native modal dialog (focus trap, Esc and inert page for free). */
export function Guide({
  open,
  onClose,
  onStart,
}: {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const body = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      body.current?.scrollTo({ top: 0 });
    }
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="guide"
      aria-labelledby="guide-title"
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="guide-sheet">
        <header className="guide-header">
          <div>
            <h2 id="guide-title">Hướng dẫn sử dụng</h2>
            <p>Ba bước, khoảng 5 phút cho lần đầu.</p>
          </div>
          <button type="button" className="secondary" onClick={onClose}>
            Đóng
          </button>
        </header>
        <nav className="guide-nav" aria-label="Mục lục hướng dẫn">
          {sections.map((section) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(section.id)?.scrollIntoView({ block: 'start' });
              }}
            >
              {section.label}
            </a>
          ))}
        </nav>
        <div className="guide-body" ref={body}>
          <section id="guide-overview" aria-labelledby="guide-overview-heading">
            <h3 id="guide-overview-heading">Công cụ này giúp bạn làm gì?</h3>
            <p>
              Trước ngày sale, bạn cần biết một voucher có làm shop <strong>lời thêm</strong> hay
              chỉ làm <strong>mất biên lợi nhuận</strong>. Market Maker tính lợi nhuận khi không
              chạy voucher và khi chạy từng mức giảm, trên cùng số liệu bạn nhập, rồi xếp hạng theo
              mục tiêu bạn chọn.
            </p>
            <ol className="guide-steps">
              <li>
                <span className="step-number">1</span>
                <span>
                  <strong>Nhập số liệu</strong>
                  Giá, giá vốn, phí, tồn kho, voucher và lượng khách dự kiến.
                </span>
              </li>
              <li>
                <span className="step-number">2</span>
                <span>
                  <strong>Đọc kết quả</strong>
                  So sánh các phương án, chọn một và xuất kế hoạch.
                </span>
              </li>
              <li>
                <span className="step-number">3</span>
                <span>
                  <strong>Nhờ AI (tùy chọn)</strong>
                  AI đề xuất thêm mức giảm; công cụ tính lại và so cùng các phương án cũ.
                </span>
              </li>
            </ol>
            <p className="guide-note">
              Lần đầu mở, ô nhập đã có <strong>dữ liệu mẫu</strong> (một chai serum). Bạn có thể bấm
              sang tab Kết quả ngay để xem công cụ trả lời thế nào, rồi quay lại thay bằng số liệu
              shop mình.
            </p>
          </section>

          <section id="guide-input" aria-labelledby="guide-input-heading">
            <h3 id="guide-input-heading">Bước 1 · Nhập số liệu</h3>
            <p>Điền theo thứ tự từ trên xuống. Kết quả tự tính lại mỗi khi bạn sửa một ô.</p>
            <dl className="guide-fields">
              <div>
                <dt>Sản phẩm trong giỏ</dt>
                <dd>
                  Giá bán, giá vốn, chi phí đóng gói và tồn kho của từng SKU. Một đơn hàng gồm đúng
                  các SKU này; bấm <em>Thêm SKU vào giỏ</em> nếu khách thường mua kèm.
                </dd>
              </div>
              <div>
                <dt>Voucher shop</dt>
                <dd>
                  Giảm theo % (có mức giảm tối đa) hoặc giảm số tiền cố định, kèm giỏ tối thiểu.
                  <em> Ngân sách shop</em> và <em>Lượt voucher tối đa</em> là giới hạn cứng: hết là
                  dừng ưu đãi.
                </dd>
              </div>
              <div>
                <dt>Phí sàn</dt>
                <dd>
                  Chọn <em>Ngành hàng Shopee</em> để dùng bảng phí có nguồn, hoặc tự nhập phí, thuế,
                  ship, quảng cáo và tỷ lệ hoàn hàng trong mục mở rộng.
                </dd>
              </div>
              <div>
                <dt>Traffic & mục tiêu</dt>
                <dd>
                  Số lượt xem ngày thường và tỷ lệ mua (CVR) khi không có voucher. Ba hệ số traffic
                  thấp / cơ sở / cao là các tình huống bạn muốn thử cho ngày sale, ví dụ ×1,5 / ×3 /
                  ×5.
                </dd>
              </div>
              <div>
                <dt>Ưu tiên quyết định</dt>
                <dd>
                  <strong>Thận trọng</strong>: chọn phương án lời nhiều nhất trong kịch bản tệ nhất.{' '}
                  <strong>Cân bằng</strong>: 70% kịch bản cơ sở + 30% kịch bản tệ nhất.{' '}
                  <strong>Tăng trưởng</strong>: chọn doanh thu cao nhất.
                </dd>
              </div>
              <div>
                <dt>Phản ứng khách với mức giảm</dt>
                <dd>
                  Giả định của bạn: giảm bao nhiêu % thì tỷ lệ mua tăng bao nhiêu lần. Không chắc
                  thì giữ mặc định và thử vài mức để xem kết quả nhạy đến đâu.
                </dd>
              </div>
            </dl>
          </section>

          <section id="guide-results" aria-labelledby="guide-results-heading">
            <h3 id="guide-results-heading">Bước 2 · Đọc kết quả</h3>
            <p>
              Bảng <em>Top chiến lược</em> luôn có phương án <strong>Không voucher</strong> để so
              sánh. Chọn một hàng, phần bên dưới mở ra dạng phiếu voucher:
            </p>
            <figure className="guide-ticket" aria-label="Ví dụ phiếu kết quả có chú thích">
              <div className="guide-ticket-card">
                <p className="guide-ticket-eyebrow">
                  <span className="callout">a</span> Voucher nên chạy theo mục tiêu của bạn
                </p>
                <p className="guide-ticket-name">Voucher hiện tại</p>
                <p className="guide-ticket-chip">
                  <span className="callout">b</span> Giảm 15% · tối đa 50.000 ₫
                </p>
                <div className="guide-ticket-kpis">
                  <span>
                    Doanh thu
                    <strong>81.836.300 ₫</strong>
                  </span>
                  <span className="profit">
                    <span className="callout">c</span> Lợi nhuận ước tính
                    <strong>30.264.744 ₫</strong>
                  </span>
                </div>
              </div>
              <figcaption>
                <ol className="guide-callouts">
                  <li>
                    <span className="callout">a</span>Phương án đứng đầu theo mục tiêu bạn chọn,
                    hoặc phương án bạn đang xem.
                  </li>
                  <li>
                    <span className="callout">b</span>Mức giảm thực tế mỗi giỏ. Đây là cấu hình bạn
                    sẽ tạo trên sàn.
                  </li>
                  <li>
                    <span className="callout">c</span>Lợi nhuận sau voucher, phí, giá vốn và hoàn
                    hàng. Xanh là lời, đỏ là lỗ.
                  </li>
                </ol>
              </figcaption>
            </figure>
            <ul className="guide-list">
              <li>
                Bấm <strong>Thấp / Cơ sở / Cao</strong> để xem cùng phương án khi traffic khác đi.
                Thứ hạng giữ nguyên, chỉ số liệu thay đổi.
              </li>
              <li>
                Thanh <strong>Ngân sách</strong> và <strong>Quota</strong> cho biết voucher có hết
                trước khi hết khách không.
              </li>
              <li>
                Bấm <strong>Xuất phương án đang chọn</strong> để tải tệp JSON gồm số liệu, kết quả
                và giả định. Có thể nhập lại sau bằng nút <em>Nhập kế hoạch JSON</em>.
              </li>
            </ul>
          </section>

          <section id="guide-ai" aria-labelledby="guide-ai-heading">
            <h3 id="guide-ai-heading">Bước 3 · Nhờ AI (tùy chọn)</h3>
            <div className="guide-split">
              <div>
                <h4>AI làm</h4>
                <ul className="guide-list">
                  <li>Đọc ghi chú về shop, khách hàng và lịch sử sale bạn nhập.</li>
                  <li>Đề xuất tối đa 5 cấu hình voucher mới.</li>
                </ul>
              </div>
              <div>
                <h4>AI không làm</h4>
                <ul className="guide-list">
                  <li>Không tự tính lợi nhuận: công cụ tính lại mọi đề xuất.</li>
                  <li>Không sửa giá vốn, tồn kho, ngân sách hay traffic của bạn.</li>
                </ul>
              </div>
            </div>
            <p>
              Khi có kết quả, bạn được đưa về tab Kết quả. Dùng nút{' '}
              <strong>Phương án cơ sở / Ứng viên có AI</strong> để so sánh, và{' '}
              <strong>Áp dụng voucher vào thiết lập</strong> nếu muốn dùng đề xuất. Mỗi lần bấm AI
              có tính phí theo tài khoản OpenAI của server.
            </p>
          </section>

          <section id="guide-terms" aria-labelledby="guide-terms-heading">
            <h3 id="guide-terms-heading">Thuật ngữ</h3>
            <dl className="guide-terms">
              <div>
                <dt>CVR</dt>
                <dd>Tỷ lệ lượt xem thành đơn. 3% nghĩa là 100 lượt xem có 3 đơn.</dd>
              </div>
              <div>
                <dt>Kịch bản thấp / cơ sở / cao</dt>
                <dd>Ba mức traffic bạn tự đặt, không phải xác suất hay dự báo.</dd>
              </div>
              <div>
                <dt>Shop tài trợ</dt>
                <dd>Phần tiền giảm shop tự chịu. 100% là shop trả toàn bộ.</dd>
              </div>
              <div>
                <dt>Quota</dt>
                <dd>Số lượt dùng voucher tối đa. Hết quota, khách mua với giá gốc.</dd>
              </div>
              <div>
                <dt>Không voucher</dt>
                <dd>Phương án đối chứng. Voucher chỉ đáng chạy nếu lời hơn phương án này.</dd>
              </div>
              <div>
                <dt>Lợi nhuận ước tính</dt>
                <dd>Doanh thu sau giảm giá, trừ phí sàn, giá vốn, đóng gói và hoàn hàng.</dd>
              </div>
            </dl>
          </section>

          <section id="guide-limits" aria-labelledby="guide-limits-heading">
            <h3 id="guide-limits-heading">Lưu ý trước khi quyết định</h3>
            <ul className="guide-list">
              <li>Đây là mô phỏng theo số liệu bạn nhập, không phải dự báo doanh số.</li>
              <li>Công cụ không tự tạo hay đổi voucher trên Shopee; bạn tự cấu hình trên sàn.</li>
              <li>Bảng phí Shopee là bản lưu có ngày ghi nhận; hãy kiểm tra phí hiện hành.</li>
              <li>Bản nháp chỉ lưu trên trình duyệt này. Xuất JSON nếu muốn giữ lâu dài.</li>
            </ul>
          </section>
        </div>
        <footer className="guide-footer">
          <button type="button" className="primary" onClick={onStart}>
            Bắt đầu với bước 1
          </button>
        </footer>
      </div>
    </dialog>
  );
}
