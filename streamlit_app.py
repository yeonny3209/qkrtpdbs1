import streamlit as st
import random

def home_page():
    st.title("🌟 환영합니다! 나만의 첫 웹 페이지입니다.")
    st.subheader("스트림릿(Streamlit)으로 만든 멋진 첫 화면에 오신 것을 환영해요!")
    st.divider()
    
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

def game_page():
    st.title("🎮 업다운(Up-Down) 게임")
    st.write("컴퓨터가 1부터 100 사이의 숫자 하나를 생각했습니다. 맞춰보세요!")

    if "target_number" not in st.session_state:
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0

    with st.form(key="updown_form", clear_on_submit=False):
        user_input = st.text_input("숫자를 입력하고 엔터를 누르세요 (1~100)")
        submit_button = st.form_submit_button(label="정답 확인")

    if submit_button:
        if user_input.isdigit():
            user_guess = int(user_input)
            
            if not st.session_state.game_over:
                st.session_state.attempts += 1
                
                if user_guess < st.session_state.target_number:
                    st.info(f"🔺 UP! 컴퓨터가 생각한 숫자가 더 큽니다. (시도 횟수: {st.session_state.attempts}회)")
                elif user_guess > st.session_state.target_number:
                    st.info(f"🔻 DOWN! 컴퓨터가 생각한 숫자가 더 작습니다. (시도 횟수: {st.session_state.attempts}회)")
                else:
                    st.success(f"🎉 정답입니다! {st.session_state.attempts}번 만에 맞추셨습니다!")
                    st.session_state.game_over = True
            else:
                st.warning("게임이 끝났습니다. 새로운 게임을 시작하려면 아래 재시작 버튼을 눌러주세요.")
        else:
            st.error("숫자만 정확하게 입력해 주세요!")

    if st.button("게임 재시작"):
        st.session_state.target_number = random.randint(1, 100)
        st.session_state.game_over = False
        st.session_state.attempts = 0
        st.rerun()

def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    colors = ["🔴 빨강", "🔵 파랑", "🟡 노랑", "🟢 초록"]

    if "board_players" not in st.session_state:
        st.session_state.board_players = 2
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 시작합니다!"]
        st.session_state.winner = None

    if st.session_state.winner is None:
        new_num_players = st.selectbox("플레이어 인원 선택 (인원 변경 시 게임이 새롭게 리셋됩니다)", [2, 3, 4], index=st.session_state.board_players - 2)
        if new_num_players != st.session_state.board_players:
            st.session_state.board_players = new_num_players
            st.session_state.positions = [1, 1, 1, 1]
            st.session_state.turn = 0
            st.session_state.log = ["인원이 변경되어 게임을 리셋합니다!"]
            st.session_state.winner = None
            st.rerun()

    st.divider()

    st.subheader("🗺️ 실시간 게임 보드판")
    board_html = "<div style='display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; background-color: #f5f5f5; padding: 15px; border-radius: 12px; border: 2px solid #ccc; max-width: 900px; margin: auto;'>"
    
    for r in range(4, -1, -1):
        for c in range(10):
            if r % 2 == 0:
                num = r * 10 + 1 + c
            else:
                num = r * 10 + 10 - c
            
            present_players = ""
            for p_idx in range(st.session_state.board_players):
                if st.session_state.positions[p_idx] == num:
                    present_players += colors[p_idx].split()[0]
            
            bg_color = "#ffffff"
            note = ""
            border_style = "1px solid #ddd"
            
            if num == 1:
                bg_color = "#fff9db"
                note = "START"
                border_style = "2px solid #fcc419"
            elif num == 50:
                bg_color = "#e3fafc"
                note = "GOAL"
                border_style = "2px solid #22b8cf"
            elif num in ladders:
                note = f"🪜 ➔ {ladders[num]}"
                bg_color = "#ebfbee"
            elif num in snakes:
                note = f"🐍 ➔ {snakes[num]}"
                bg_color = "#fff5f5"
            elif num in ladders.values():
                bg_color = "#f4fbf7"
            elif num in snakes.values():
                bg_color = "#fffafb"
            
            board_html += f"""
            <div style='background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 1px 1px 4px rgba(0,0,0,0.04);'>
                <div style='font-size: 12px; font-weight: bold; color: #495057; text-align: left;'>{num}</div>
                <div style='font-size: 18px; margin: 2px 0; min-height: 24px;'>{present_players}</div>
                <div style='font-size: 9px; color: #868e96; font-weight: bold;'>{note}</div>
            </div>
            """
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with cols[i]:
            st.metric(label=colors[i], value=f"{st.session_state.positions[i]}번 칸")

    st.divider()

    if st.session_state.winner:
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 50번 칸에 먼저 골인하여 승리했습니다!")
    else:
        current_player = colors[st.session_state.turn]
        st.subheader(f"👉 현재 차례: {current_player}")
        
        if st.button("🎲 주사위 던지기"):
            dice_roll = random.randint(1, 6)
            old_pos = st.session_state.positions[st.session_state.turn]
            new_pos = old_pos + dice_roll
            
            log_msg = f"{current_player}이(가) 주사위 {dice_roll}을(를) 굴렸습니다. ({old_pos} ➔ {new_pos})"
            
            if new_pos >= 50:
                new_pos = 50
                st.session_state.positions[st.session_state.turn] = new_pos
                st.session_state.winner = current_player
                st.session_state.log.insert(0, log_msg + " 🏁 골인!!")
            else:
                if new_pos in ladders:
                    up_pos = ladders[new_pos]
                    log_msg += f" 🪜 사다리 발견! {new_pos}번에서 {up_pos}번 칸으로 초고속 점프!"
                    new_pos = up_pos
                elif new_pos in snakes:
                    down_pos = snakes[new_pos]
                    log_msg += f" 🐍 뱀을 만났습니다! {new_pos}번에서 {down_pos}번 칸으로 미끄러집니다..."
                    new_pos = down_pos
                
                st.session_state.positions[st.session_state.turn] = new_pos
                st.session_state.log.insert(0, log_msg)
                st.session_state.turn = (st.session_state.turn + 1) % st.session_state.board_players
            
            st.rerun()

    if st.button("🔄 게임 처음부터 다시 시작"):
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 리셋했습니다!"]
        st.session_state.winner = None
        st.rerun()

    st.write("### 📜 전광판 (최신 5개 기록)")
    for msg in st.session_state.log[:5]:
        st.write(msg)

st.set_page_config(
    page_title="나만의 첫 스트림릿 앱",
    page_icon="🌟",
    layout="wide"
)

home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="말판 게임", icon="🎲")

pg = st.navigation([home, game, board])
pg.run()
