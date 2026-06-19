import streamlit as st
import random

# ==========================================
# 1. 홈 화면 페이지
# ==========================================
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

# ==========================================
# 2. 업다운 게임 페이지
# ==========================================
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

# ==========================================
# 3. 오리지널 뱀사다리 말판 게임 페이지
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    st.write("주사위를 굴려 가장 먼저 50번 칸에 도착하는 사람이 승리합니다!")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    emojis = ["🔴", "🔵", "🟡", "🟢"]

    # 데이터 독립 저장 공간 설정
    if "board_players" not in st.session_state:
        st.session_state.board_players = 2
    if "positions" not in st.session_state:
        st.session_state.positions = [1, 1, 1, 1]
    if "turn" not in st.session_state:
        st.session_state.turn = 0
    if "log" not in st.session_state:
        st.session_state.log = ["게임을 시작합니다!"]
    if "winner" not in st.session_state:
        st.session_state.winner = None
    if "custom_names" not in st.session_state:
        st.session_state.custom_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]

    st.subheader("👥 게임 인원 및 이름 설정")
    new_num_players = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 3, 4], index=st.session_state.board_players - 2, key="board_p_select")
    
    if new_num_players != st.session_state.board_players:
        st.session_state.board_players = new_num_players
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["인원이 변경되어 게임을 리셋합니다!"]
        st.session_state.winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with name_cols[i]:
            default_name = f"플레이어 {i+1}"
            if st.session_state.custom_names[i] == f"플레이어 {i+1}" or st.session_state.custom_names[i] == "":
                st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=default_name, key=f"p_name_{i}")
            else:
                st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=st.session_state.custom_names[i], key=f"p_name_{i}")

    display_names = []
    for i in range(4):
        display_names.append(f"{emojis[i]} {st.session_state.custom_names[i]}")

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
                    present_players += emojis[p_idx]
            
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
            
            cell_style = f"background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 1px 1px 4px rgba(0,0,0,0.04);"
            board_html += f"<div style='{cell_style}'>"
            board_html += f"<div style='font-size: 12px; font-weight: bold; color: #495057; text-align: left;'>{num}</div>"
            board_html += f"<div style='font-size: 18px; margin: 2px 0; min-height: 24px;'>{present_players}</div>"
            board_html += f"<div style='font-size: 9px; color: #868e96; font-weight: bold;'>{note}</div>"
            board_html += "</div>"
            
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()

    cols = st.columns(st.session_state.board_players)
    for i in range(st.session_state.board_players):
        with cols[i]:
            st.metric(label=display_names[i], value=f"{st.session_state.positions[i]}번 칸")

    st.divider()

    if st.session_state.winner:
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 50번 칸에 먼저 골인하여 승리했습니다!")
    else:
        current_player = display_names[st.session_state.turn]
        st.subheader(f"👉 현재 차례: {current_player}")
        
        if st.button("🎲 주사위 던지기", key="roll_dice_btn"):
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

    if st.button("🔄 게임 처음부터 다시 시작", key="reset_board_btn"):
        st.session_state.positions = [1, 1, 1, 1]
        st.session_state.turn = 0
        st.session_state.log = ["게임을 리셋했습니다!"]
        st.session_state.winner = None
        st.rerun()

    st.write("### 📜 전광판 (최신 5개 기록)")
    for msg in st.session_state.log[:5]:
        st.write(msg)


# ==========================================
# 4. 쿼리도 두뇌 게임용 알고리즘 함수 및 페이지
# ==========================================
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

def quoridor_page():
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
    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1, key="q_p_select")
    
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.session_state.q_log = ["인원이 변경되어 게임을 리셋합니다!"]
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
        
        action = st.radio("행동을 선택하세요", ["말 이동하기", "벽 설치하기"], horizontal=True, key="q_action_radio")
        
        cr, cc = st.session_state.q_positions[curr_idx]
        
        if action == "말 이동하기":
            move_cols = st.columns(4)
            
            can_up = cr > 0 and not st.session_state.q_walls_h[cr-1][cc]
            can_down = cr < 8 and not st.session_state.q_walls_h[cr][cc]
            can_left = cc > 0 and not st.session_state.q_walls_v[cr][cc-1]
            can_right = cc < 8 and not st.session_state.q_walls_v[cr][cc]
            
            with move_cols[0]:
                if st.button("⬆️ 위로 이동", disabled=not can_up, use_container_width=True, key="q_up"):
                    st.session_state.q_positions[curr_idx] = [cr-1, cc]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 위로 이동했습니다."
                    if curr_idx == 0 and cr-1 == 0:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
            with move_cols[1]:
                if st.button("⬇️ 아래로 이동", disabled=not can_down, use_container_width=True, key="q_down"):
                    st.session_state.q_positions[curr_idx] = [cr+1, cc]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 아래로 이동했습니다."
                    if curr_idx == 1 and cr+1 == 8:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
            with move_cols[2]:
                if st.button("⬅️ 왼쪽 이동", disabled=not can_left, use_container_width=True, key="q_left"):
                    st.session_state.q_positions[curr_idx] = [cr, cc-1]
                    log_text = f"{emojis[curr_idx]} {st.session_state.q_names[curr_idx]}님이 왼쪽으로 이동했습니다."
                    if curr_idx == 3 and cc-1 == 0:
                        st.session_state.q_winner = st.session_state.q_names[curr_idx]
                    st.session_state.q_log.insert(0, log_text)
                    if not st.session_state.q_winner:
                        st.session_state.q_turn = (curr_idx + 1) % st.session_state.q_players
                    st.rerun()
                    
            with move_cols[3]:
                if st.button("➡️ 오른쪽 이동", disabled=not can_right, use_container_width=True, key="q_right"):
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
                w_type = st.selectbox("벽 종류", ["가로 벽 (칸 아래쪽에 설치)", "세로 벽 (칸 오른쪽에 설치)"], key="q_w_type")
                
                c1, c2 = st.columns(2)
                with c1:
                    w_row = st.number_input("행 위치 (1 ~ 8)", min_value=1, max_value=8, value=1, key="q_w_row") - 1
                with c2:
                    w_col = st.number_input("열 위치 (1 ~ 8)", min_value=1, max_value=8, value=1, key="q_w_col") - 1
                
                if st.button("🧱 선택한 위치에 벽 설치하기", key="q_place_wall_btn"):
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

    if st.button("🔄 게임 처음부터 다시 시작", key="q_reset_btn"):
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


# ==========================================
# 5. 메인 네비게이션 설정 (사이드바 메뉴 구성)
# ==========================================
st.set_page_config(
    page_title="나만의 첫 스트림릿 앱",
    page_icon="🌟",
    layout="wide"
)

# 총 4개의 페이지를 등록합니다.
home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")

# 사이드바 네비게이션 생성
pg = st.navigation([home, game, board, quoridor])
pg.run()
