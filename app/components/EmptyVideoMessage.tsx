import React from 'react';

const EmptyVideoMessage: React.FC = () => {
  return (
    <div className="text-center p-8 bg-white rounded-lg shadow-sm">
      <p className="text-black mb-4">暂无视频内容，请上传一些视频！</p>
      <p className="text-sm text-black mb-4">
        如果您刚刚上传了视频但未显示，请刷新页面尝试重新加载。
      </p>
      <div className="text-sm bg-yellow-50 p-3 rounded border border-yellow-200">
        <p className="font-semibold text-black">提示：</p>
        <ul className="list-disc pl-5 text-black">
          <li>确保上传已完成</li>
          <li>尝试刷新页面</li>
          <li>查看是否有网络问题</li>
          <li>内容可能需要一些时间才能显示</li>
        </ul>
      </div>
    </div>
  );
};

export default EmptyVideoMessage;
