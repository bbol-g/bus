export default function ExcelUploadPreview(){
  return <section><h2>엑셀 업로드/미리보기</h2><input type='file' disabled /><p className='warn'>엑셀 파서는 2차 작업에서 구현 예정입니다.</p><div className='placeholder'>파싱 미리보기 placeholder</div><div className='placeholder error'>오류/경고 placeholder</div><button disabled>저장(준비중)</button></section>
}
