
import streamlit as st

st.set_page_config(
    page_title="나만의 첫 스트림릿 앱",
    page_icon="🌟",
    layout="wide",
    initial_sidebar_state="expanded"
)

st.title("🌟 환영합니다! 나만의 첫 웹 페이지입니다.")
st.subheader("스트림릿(Streamlit)으로 만든 멋진 첫 화면에 오신 것을 환영해요!")

st.divider()

with st.sidebar:
    st.header("📌 메뉴")
    st.info("이곳은 사이드바입니다. 나중에 여러 페이지를 만들거나 필터 옵션을 넣을 때 아주 유용하게 쓰여요.")

col1, col2 = st.columns(2)

with col1:
    st.write("### 💡 이 앱에 대하여")
    st.write("""
    이곳에는 웹페이지의 소개글이나 사용 방법을 적을 수 있어.
    스트림릿은 복잡한 HTML이나 CSS 없이 파이썬만으로도 
    이렇게 훌륭한 UI를 만들 수 있게 해 주는 아주 강력한 도구야.
    """)

with col2:
    st.write("### 🛠️ 기능 테스트")
    st.write("간단한 버튼과 입력창을 테스트해 볼 수 있어.")
    
    user_name = st.text_input("이름을 입력해 보세요!")
    
    if st.button("인사하기"):
        if user_name:
            st.success(f"반가워요, {user_name}님! 멋진 프로그래밍을 응원할게요!")
        else:
            st.warning("이름을 먼저 입력해 주세요.")
