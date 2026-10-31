import type { Health } from '../types';

export function AiPanel({
  health,
  busy,
  hasResult,
  onRecommend,
  onCancel,
  onRefresh,
}: {
  health: Health | null;
  busy: boolean;
  hasResult: boolean;
  onRecommend: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  return (
    <section className="card ai-panel" aria-labelledby="ai-heading" aria-busy={busy}>
      <h2 id="ai-heading">Tạo tối đa 5 voucher mới bằng AI</h2>
      <p>
        AI đọc số liệu và ghi chú ở trên rồi đề xuất voucher. Lợi nhuận vẫn do công cụ tính lại và
        so cùng các phương án gốc.
      </p>
      {!health && (
        <p className="notice">
          Chưa xác minh kết nối backend.{' '}
          <button className="text-button" type="button" onClick={onRefresh}>
            Kiểm tra lại
          </button>
        </p>
      )}
      {health && !health.aiConfigured && (
        <p className="notice">
          AI chưa được cấu hình trên server. Mô phỏng vẫn dùng được. Quản trị viên cần cấu hình
          provider key và model rồi khởi động lại.{' '}
          <button className="text-button" type="button" onClick={onRefresh}>
            Kiểm tra lại
          </button>
        </p>
      )}
      <div className="actions">
        <button
          className="primary"
          type="button"
          disabled={busy || !health?.aiConfigured || !hasResult}
          onClick={onRecommend}
        >
          {busy ? 'Đang tạo và kiểm tra ứng viên…' : 'Đề xuất bằng AI'}
        </button>
        {busy && (
          <button className="secondary" type="button" onClick={onCancel}>
            Hủy yêu cầu AI
          </button>
        )}
      </div>
      <p className="hint">
        Chỉ chạy khi bạn bấm và có tính phí theo tài khoản OpenAI. Sửa số liệu sẽ hủy yêu cầu đang
        chạy.
      </p>
    </section>
  );
}
