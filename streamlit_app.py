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

def check_path(start, p_idx, num_p, h_walls, v_walls):
    queue = [start]
    visited = {tuple(start)}
    while queue:
        r, c = queue.pop(0)
        if p_idx == 0 and r == 0: return True
        if p_idx == 1 and r == 8: return True
        if p_idx == 2 and c == 8: return True
        if p_idx == 3 and c == 0: return True
        
        if r > 0 and (r-1, c) not in visited and not h_walls[r-1][c]:
            visited.add((r-1, c))
            queue.append([r-1, c])
        if r < 8 and (r+1, c) not in visited and not h_walls[r][c]:
            visited.add((r+1, c))
            queue.append([r+1, c])
        if c > 0 and (r, c-1) not in visited and not v_walls[r][c-1]:
            visited.add((r, c-1))
            queue.append([r, c-1])
        if c < 8 and (r, c+1) not in visited and not v_walls[r][c]:
            visited.add((r, c+1))
            queue.append([r, c+1])
    return False

def check_all_paths(positions, num_p, h_walls, v_walls):
    for i in range(num_p):
        if not check_path(positions[i], i, num_p, h_walls, v_walls):
            return False
    return True

def board_page():
    st.title("🧱 🧠 2~4인용 전략 두뇌 게임: 쿼리도")
    st.write("상대방보다 먼저 반대편 끝 라인에 도달하면 승리합니다! 말을 움직이거나 벽을 세워 상대를 방해하세요.")
    
    emojis = ["🔴", "🔵", "🟡", "🟢"]
    
    if "q_players" not in st.session_state:
        st.session_state.q_players = 2
    if "q_positions" not in st.session_state:
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
    if "q_walls_h" not in st.session_state:
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
    if "q_walls_v" not in st.session_state:
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
    if "q_wall_counts" not in st.session_state:
        st.session_state.q_wall_counts = [10, 10, 5, 5]
    if "q_turn" not in st.session_state:
        st.session_state.q_turn = 0
    if "q_winner" not in st.session_state:
        st.session_state.q_winner = None
    if "q_names" not in st.session_state:
        st.session_state.q_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]
    if "q_log" not in st.session_state:
        st.session_state.q_log = ["게임을 시작합니다!"]

    st.subheader("👥 게임 인원 및 이름 설정")
    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1)
    
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.session_state.q_log = ["인원이 변경되어 게임을 리셋합니다!"]
        st.clear_control_inputs = True
        st.rerun()

    name_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        with name_cols[i]:
            st.session_state.q_names[i] = st.text_input(f"{emojis[i]} 이름", value=st.session_state.q_names[i], key=f"q_name_input_{i}")

    st.divider()

    st.subheader("🗺️ 쿼리도 실시간 보드판")
    
    board_html = "<div style='display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px; background-color: #343a40; padding: 12px; border-radius: 12px; max-width: 550px; margin: auto; box-sizing: border-box;'>"
    
    for r in range(9):
        for c in range(9):
            cell_p = ""
            for p_idx in range(st.session_state.q_players):
                if st.session_state.q_positions[p_idx] == [r, c]:
                    cell_p = emojis[p_idx]
            
            b_bottom = "2px solid #495057"
            b_right = "2px solid #495057"
            
            if r < 8 and st.session_state.q_walls_h[r][c]:
                b_bottom = "6px solid #ff8787"
            if c < 8 and st.session_state.q_walls_v[r][c]:
                b_right = "6px solid #ff8787"
                
            bg = "#212529"
            if r == 0: bg = "#2b3b4c"
            elif r == 8: bg = "#4c3b2b"
            if st.session_state.q_players == 4:
                if c == 0: bg = "#4c4c2b"
                elif c == 8: bg = "#2b4c2b"
                
            cell_style = f"background-color: {bg}; border-bottom: {b_bottom}; border-right: {b_right}; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 24px; box-sizing: border-box;"
            board_html += f"<div style='{cell_style}'>{cell_p}</div>"
            
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    status_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        with status_cols[i]:
            st.metric(label=f"{emojis[i]} {st.session_state.q_names[i]}", value=f"벽 {st.session_state.q_wall_counts[i]}개 남음")

    st.divider()

    if st.session_state.q_winner:
        st.success(f"🎉 축하합니다! {st.session_state.q_winner}님이 승리하셨습니다!")
    else:
        curr_idx = st.session_state.q_turn
        st.subheader(f"👉 현재 차례: {emojis[curr_idx]} {st.session_state.q_names[curr_idx]}")
        
        action = st.radio("행동을 선택하세요", ["말 이동하기", "벽 설치하기"], horizontal=True)
        
        cr, cc = st.session_state.q_positions[curr_idx]
        
        if action == "말 이동하기":
            move_cols = st.columns(4)
            
            can_up = cr > 0 and not st.session_state.q_walls_h[cr-1][cc]
            can_down = r_down = cr < 8 and not st.session_state.q_walls_h[cr][cc]
            can_left = cc > 0 and not st.session_state.q_walls_v[cr][cc-1]
            can_right = cc < 8 and not st.session_state.q_walls_v[cr][cc]
            
            with move_cols[0]:
                if st.button("⬆️ 위로 이동", disabled=not can_up, use_container_width=True):
                    st.session_state.q_positions[curr_idx] = [cr-1, cc]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 위로 이동했습니다."
                    
                    if curr_idx == 0 and cr-1 == 0:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
            with move_cols[1]:
                if st.button("⬇️ 아래로 이동", disabled=not can_down, use_container_width=True):
                    st.session_state.q_positions[curr_idx] = [cr+1, cc]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 아래로 이동했습니다."
                    
                    if curr_idx == 1 and cr+1 == 8:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
            with move_cols[2]:
                if st.button("⬅️ 왼쪽 이동", disabled=not can_left, use_container_width=True):
                    st.session_state.q_positions[curr_idx] = [cr, cc-1]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 왼쪽으로 이동했습니다."
                    
                    if curr_idx == 3 and cc-1 == 0:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
            with move_cols[3]:
                if st.button("➡️ 오른쪽 이동", disabled=not can_right, use_container_width=True):
                    st.session_state.q_positions[curr_idx] = [cr, cc+1]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 오른쪽으로 이동했습니다."
                    
                    if curr_idx == 2 and cc+1 == 8:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
        elif action == "벽 설치하기":
            if st.session_state.q_wall_counts[curr_idx] <= 0:
                st.error("남은 벽이 없습니다! 말을 이동하세요.")
            else:
                w_type = st.selectbox("벽 종류", ["가로 벽 (칸 아래쪽에 설치)", "세로 벽 (칸 오른쪽에 설치)"])
                
                c1, c2 = st.columns(2)
                with c1:
                    w_row = st.number_input("행 위치 (1 ~ 8)", min_value=1, max_value=8, value=1) - 1
                with c2:
                    w_col = st.number_input("열 위치 (1 ~ 8)", min_value=1, max_value=8, value=1) - 1
                
                if st.button("🧱 선택한 위치에 벽 설치하기"):
                    success = False
                    if "가로" in w_type:
                        if not st.session_state.q_walls_h[w_row][w_col] and not st.session_state.q_walls_h[w_row][w_col+1]:
                            st.session_state.q_walls_h[w_row][w_col] = True
                            st.session_state.q_walls_h[w_row][w_col+1] = True
                            
                            if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v):
                                success = True
                            else:
                                st.session_state.q_walls_h[w_row][w_col] = False
                                st.session_state.q_walls_h[w_row][w_col+1] = False
                                st.error("⚠️ 플레이어의 길을 완전하게 차단하는 벽은 놓을 수 없습니다! (규칙 위반)")
                        else:
                            st.error("⚠️ 이미 해당 위치나 겹치는 곳에 벽이 존재합니다.")
                    else:
                        if not st.session_state.q_walls_v[w_row][w_col] and not st.session_state.q_walls_v[w_row+1][w_col]:
                            st.session_state.q_walls_v[w_row][w_col] = True
                            st.session_state.q_walls_v[w_row+1][w_col] = True
                            
                            if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v):
                                success = True
                            else:
                                st.session_state.q_walls_v[w_row][w_col] = False
                                st.session_state.q_walls_v[w_row+1][w_col] = False
                                st.error("⚠️ 플레이어의 길을 완전하게 차단하는 벽은 놓을 수 없습니다! (규칙 위반)")
                        else:
                            st.error("⚠️ 이미 해당 위치나 겹치는 곳에 벽이 존재합니다.")
                            
                    if success:
                        st.session_state.q_wall_counts[curr_idx] -= 1
                        log_msg = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 ({w_row+1}, {w_col+1}) 위치에 벽을 세웠습니다."
                        st.session_state.q_log.insert(0, log_msg)
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                        st.rerun()

    if st.button("🔄 게임 처음부터 다시 시작"):
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if st.session_state.q_players == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.session_state.q_log = ["게임을 새롭게 초기화했습니다!"]
        st.rerun()

    st.write("### 📜 전광판 (최신 5개 기록)")
    for msg in st.session_state.q_log[:5]:
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
