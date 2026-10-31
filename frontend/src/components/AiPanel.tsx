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
    <section className="card ai-panel" aria-labelledby="ai-heading">
      <span className="pill">AI · TẠO ỨNG VIÊN</span>
      <h2 id="ai-heading">Khám phá thêm cách cấu hình voucher</h2>
      <p>
        AI đọc thông số và bối cảnh để đề xuất tối đa 5 voucher. Engine xếp hạng cùng baseline; AI
        không tự dự đoán lợi nhuận.
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
        AI chỉ chạy khi bạn bấm. Thay đổi đầu vào sẽ hủy yêu cầu cũ. Chi phí phụ thuộc tài khoản
        provider; không có phản hồi giả khi thiếu cấu hình.
      </p>
    </section>
  );
}
