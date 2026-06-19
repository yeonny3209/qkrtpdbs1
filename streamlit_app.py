import streamlit as st
import random
import json
import os

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
# 3. 뱀사다리 말판 게임 페이지
# ==========================================
def board_page():
    st.title("🎲 뱀사다리 말판 게임 (1~50)")
    st.write("주사위를 굴려 가장 먼저 50번 칸에 도착하는 사람이 승리합니다!")
    
    ladders = {3: 15, 12: 28, 20: 34, 31: 43}
    snakes = {18: 6, 32: 10, 41: 25, 48: 22}
    emojis = ["🔴", "🔵", "🟡", "🟢"]

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
            st.session_state.custom_names[i] = st.text_input(f"{emojis[i]} 이름 입력", value=st.session_state.custom_names[i], key=f"p_name_{i}")

    display_names = [f"{emojis[i]} {st.session_state.custom_names[i]}" for i in range(st.session_state.board_players)]

    st.divider()

    st.subheader("🗺️ 실시간 게임 보드판")
    board_html = "<div style='display: grid; grid-template-columns: repeat(10, 1fr); gap: 6px; background-color: #f5f5f5; padding: 15px; border-radius: 12px; border: 2px solid #ccc; max-width: 900px; margin: auto;'>"
    
    for r in range(4, -1, -1):
        for c in range(10):
            num = r * 10 + 1 + c if r % 2 == 0 else r * 10 + 10 - c
            
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
            
            cell_style = f"background-color: {bg_color}; border: {border_style}; border-radius: 8px; padding: 6px; text-align: center; min-height: 75px; display: flex; flex-direction: column; justify-content: space-between;"
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
        st.success(f"🎉 축하합니다! {st.session_state.winner} 팀이 승리했습니다!")
    else:
        st.subheader(f"👉 현재 차례: {display_names[st.session_state.turn]}")
        if st.button("🎲 주사위 던지기", key="roll_dice_btn"):
            dice_roll = random.randint(1, 6)
            old_pos = st.session_state.positions[st.session_state.turn]
            new_pos = old_pos + dice_roll
            log_msg = f"{display_names[st.session_state.turn]}이(가) 주사위 {dice_roll}을(를) 굴렸습니다. ({old_pos} ➔ {new_pos})"
            
            if new_pos >= 50:
                st.session_state.positions[st.session_state.turn] = 50
                st.session_state.winner = display_names[st.session_state.turn]
                st.session_state.log.insert(0, log_msg + " 🏁 골인!!")
            else:
                if new_pos in ladders:
                    log_msg += f" 🪜 사다리! {new_pos}번에서 {ladders[new_pos]}번으로 이동!"
                    new_pos = ladders[new_pos]
                elif new_pos in snakes:
                    log_msg += f" 🐍 뱀이다! {new_pos}번에서 {snakes[new_pos]}번으로 미끄러짐..."
                    new_pos = snakes[new_pos]
                
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

    for msg in st.session_state.log[:5]:
        st.write(msg)

# ==========================================
# 4. 쿼리도 두뇌 게임 페이지
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
    st.title("🧱 🧠 전략 두뇌 게임: 쿼리도")
    emojis = ["🔴", "🔵", "🟡", "🟢"]
    
    if "q_players" not in st.session_state: st.session_state.q_players = 2
    if "q_positions" not in st.session_state: st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
    if "q_walls_h" not in st.session_state: st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
    if "q_walls_v" not in st.session_state: st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
    if "q_wall_counts" not in st.session_state: st.session_state.q_wall_counts = [10, 10, 5, 5]
    if "q_turn" not in st.session_state: st.session_state.q_turn = 0
    if "q_winner" not in st.session_state: st.session_state.q_winner = None
    if "q_names" not in st.session_state: st.session_state.q_names = ["플레이어 1", "플레이어 2", "플레이어 3", "플레이어 4"]
    if "q_log" not in st.session_state: st.session_state.q_log = ["게임을 시작합니다!"]

    new_num = st.selectbox("참여할 플레이어 수를 선택하세요", [2, 4], index=0 if st.session_state.q_players == 2 else 1, key="q_p_select")
    if new_num != st.session_state.q_players:
        st.session_state.q_players = new_num
        st.session_state.q_positions = [[8, 4], [0, 4], [4, 0], [4, 8]]
        st.session_state.q_walls_h = [[False]*9 for _ in range(8)]
        st.session_state.q_walls_v = [[False]*8 for _ in range(9)]
        st.session_state.q_wall_counts = [10, 10, 5, 5] if new_num == 2 else [5, 5, 5, 5]
        st.session_state.q_turn = 0
        st.session_state.q_winner = None
        st.rerun()

    name_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        st.session_state.q_names[i] = name_cols[i].text_input(f"{emojis[i]} 이름", value=st.session_state.q_names[i], key=f"q_name_{i}")

    st.divider()
    
    board_html = "<div style='display: grid; grid-template-columns: repeat(9, 1fr); gap: 0px; background-color: #343a40; padding: 12px; border-radius: 12px; max-width: 450px; margin: auto;'>"
    for r in range(9):
        for c in range(9):
            cell_p = ""
            for p_idx in range(st.session_state.q_players):
                if st.session_state.q_positions[p_idx] == [r, c]: cell_p = emojis[p_idx]
            b_bottom = "2px solid #495057"
            b_right = "2px solid #495057"
            if r < 8 and st.session_state.q_walls_h[r][c]: b_bottom = "6px solid #ff8787"
            if c < 8 and st.session_state.q_walls_v[r][c]: b_right = "6px solid #ff8787"
            bg = "#212529"
            if r == 0: bg = "#2b3b4c"
            elif r == 8: bg = "#4c3b2b"
            cell_style = f"background-color: {bg}; border-bottom: {b_bottom}; border-right: {b_right}; width: 100%; aspect-ratio: 1; display: flex; align-items: center; justify-content: center; font-size: 20px;"
            board_html += f"<div style='{cell_style}'>{cell_p}</div>"
    board_html += "</div>"
    st.markdown(board_html, unsafe_allow_html=True)

    st.divider()
    status_cols = st.columns(st.session_state.q_players)
    for i in range(st.session_state.q_players):
        status_cols[i].metric(label=st.session_state.q_names[i], value=f"벽 {st.session_state.q_wall_counts[i]}개")

    if st.session_state.q_winner:
        st.success(f"🎉 {st.session_state.q_winner}님 승리!")
    else:
        curr = st.session_state.q_turn
        st.subheader(f"👉 차례: {emojis[curr]} {st.session_state.q_names[curr]}")
        action = st.radio("행동", ["말 이동", "벽 설치"], horizontal=True, key="q_act")
        cr, cc = st.session_state.q_positions[curr]
        
        if action == "말 이동":
            m_cols = st.columns(4)
            if m_cols[0].button("⬆️ 위", disabled=not (cr > 0 and not st.session_state.q_walls_h[cr-1][cc]), key="qu"):
                st.session_state.q_positions[curr] = [cr-1, cc]
                if curr == 0 and cr-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[1].button("⬇️ 아래", disabled=not (cr < 8 and not st.session_state.q_walls_h[cr][cc]), key="qd"):
                st.session_state.q_positions[curr] = [cr+1, cc]
                if curr == 1 and cr+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[2].button("⬅️ 왼쪽", disabled=not (cc > 0 and not st.session_state.q_walls_v[cr][cc-1]), key="ql"):
                st.session_state.q_positions[curr] = [cr, cc-1]
                if curr == 3 and cc-1 == 0: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
            if m_cols[3].button("➡️ 오른쪽", disabled=not (cc < 8 and not st.session_state.q_walls_v[cr][cc]), key="qr"):
                st.session_state.q_positions[curr] = [cr, cc+1]
                if curr == 2 and cc+1 == 8: st.session_state.q_winner = st.session_state.q_names[curr]
                st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                st.rerun()
        else:
            w_type = st.selectbox("종류", ["가로 벽", "세로 벽"])
            w_row = st.number_input("행 (1~8)", 1, 8, 1) - 1
            w_col = st.number_input("열 (1~8)", 1, 8, 1) - 1
            if st.button("🧱 벽 설치"):
                ok = False
                if "가로" in w_type:
                    if not st.session_state.q_walls_h[w_row][w_col] and not st.session_state.q_walls_h[w_row][w_col+1]:
                        st.session_state.q_walls_h[w_row][w_col] = True
                        st.session_state.q_walls_h[w_row][w_col+1] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_h[w_row][w_col] = False
                            st.session_state.q_walls_h[w_row][w_col+1] = False
                else:
                    if not st.session_state.q_walls_v[w_row][w_col] and not st.session_state.q_walls_v[w_row+1][w_col]:
                        st.session_state.q_walls_v[w_row][w_col] = True
                        st.session_state.q_walls_v[w_row+1][w_col] = True
                        if check_all_paths(st.session_state.q_positions, st.session_state.q_players, st.session_state.q_walls_h, st.session_state.q_walls_v): ok = True
                        else:
                            st.session_state.q_walls_v[w_row][w_col] = False
                            st.session_state.q_walls_v[w_row+1][w_col] = False
                if ok:
                    st.session_state.q_wall_counts[curr] -= 1
                    st.session_state.q_turn = (curr + 1) % st.session_state.q_players
                    st.rerun()
                else: st.error("벽을 놓을 수 없거나 길을 완전히 막습니다!")

# ==========================================
# 5. [업그레이드] 전략 스킬/다양한 적 RPG 페이지
# ==========================================
SAVE_FILE = "rpg_save_data.json"

def rpg_page():
    st.title("⚔️ 용사 키우기 대확장 패치 (Ver 2.0)")
    st.write("화려한 전투 스킬과 궁극기를 마스터하고 10마리의 강적과 3종의 전설급 보스 레이드에 도전하세요!")

    # [💡 고품질 리팩토링] 세션 상태 변수 안전 검사 및 개별 초기화
    # 이미 다른 변수가 세션에 있어도, 새로 추가된 변수만 골라서 안전하게 생성해 줍니다.
    defaults = {
        "r_lvl": 1,
        "r_exp": 0,
        "r_max_exp": 10,
        "r_gold": 50,
        "r_max_hp": 60,
        "r_hp": 60,
        "r_b_atk": 10,
        "r_b_def": 2,
        "r_w_name": "낡은 나뭇가지",
        "r_w_atk": 0,
        "r_a_name": "천 옷",
        "r_a_def": 0,
        "r_has_skill": False,
        "r_has_ult": False,
        "r_skill_cd": 0,
        "r_ult_cd": 0,
        "r_log": ["새로운 전장에 발을 내딛습니다."],
        "r_battle": False,
        "m_cur": None
    }

    for key, value in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = value

    total_atk = st.session_state.r_b_atk + st.session_state.r_w_atk
    total_def = st.session_state.r_b_def + st.session_state.r_a_def

    # 대시보드 UI
    st.subheader("👤 용사 능력치 프로필")
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("종합 레벨", f"Lv.{st.session_state.r_lvl}")
    c2.metric("자금 보유고", f"💰 {st.session_state.r_gold} G")
    c3.metric("총 공격력", f"⚔️ {total_atk} ({st.session_state.r_b_atk}+{st.session_state.r_w_atk})")
    c4.metric("총 방어력", f"🛡️ {total_def} ({st.session_state.r_b_def}+{st.session_state.r_a_def})")

    st.write(f"❤️ **HP:** {st.session_state.r_hp} / {st.session_state.r_max_hp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_hp / st.session_state.r_max_hp)))
    st.write(f"✨ **EXP:** {st.session_state.r_exp} / {st.session_state.r_max_exp}")
    st.progress(max(0.0, min(1.0, st.session_state.r_exp / st.session_state.r_max_exp)))

    st.divider()

    tab1, tab2, tab3 = st.tabs(["🏹 차원 던전 관문", "🛒 장비 & 무공 비급 상점", "💾 모험의 서 저장"])

    # --- 1번 탭: 10마리 몬스터 + 3마리 보스 전투 시스템 ---
    with tab1:
        enemies = {
            "🟢 초록 슬라임 (Lv.1)": {"hp": 30, "atk": 5, "def": 1, "exp": 3, "gold": 15, "is_boss": False},
            "🍄 뿔 피어싱 버섯 (Lv.3)": {"hp": 45, "atk": 8, "def": 2, "exp": 5, "gold": 25, "is_boss": False},
            "👺 홉고블린 정찰병 (Lv.6)": {"hp": 70, "atk": 13, "def": 4, "exp": 8, "gold": 40, "is_boss": False},
            "🐺 굶주린 흉포한 이리 (Lv.9)": {"hp": 100, "atk": 20, "def": 6, "exp": 12, "gold": 60, "is_boss": False},
            "🦂 치명적인 사막 전갈 (Lv.12)": {"hp": 135, "atk": 27, "def": 9, "exp": 16, "gold": 80, "is_boss": False},
            "🧟 지옥 전사 스켈레톤 (Lv.15)": {"hp": 180, "atk": 35, "def": 13, "exp": 22, "gold": 110, "is_boss": False},
            "🐗 돌격대장 흑멧돼지 (Lv.19)": {"hp": 240, "atk": 44, "def": 18, "exp": 30, "gold": 150, "is_boss": False},
            "🦅 오염된 그리폰 (Lv.23)": {"hp": 310, "atk": 54, "def": 24, "exp": 40, "gold": 200, "is_boss": False},
            "👹 광포한 사이클롭스 (Lv.27)": {"hp": 400, "atk": 66, "def": 32, "exp": 55, "gold": 270, "is_boss": False},
            "👁️ 심연의 주시자 (Lv.32)": {"hp": 520, "atk": 80, "def": 42, "exp": 75, "gold": 360, "is_boss": False},
            "🤖 [네임드 보스] 무너진 고대 유적 골렘": {"hp": 850, "atk": 110, "def": 60, "exp": 150, "gold": 600, "is_boss": True},
            "❄️ [월드 보스] 폭풍의 얼음 서리 고래": {"hp": 1600, "atk": 160, "def": 95, "exp": 300, "gold": 1200, "is_boss": True},
            "🔥 [최종 레이드 보스] 종언의 화염 드래곤": {"hp": 3200, "atk": 240, "def": 150, "exp": 1000, "gold": 5000, "is_boss": True}
        }

        if not st.session_state.r_battle:
            st.write("⚔️ 도전 상대를 마주하세요:")
            m_choice = st.selectbox("전장의 적 리스트", list(enemies.keys()))
            if st.button("⚔️ 토벌 전장 입장하기"):
                st.session_state.m_cur = enemies[m_choice].copy()
                st.session_state.m_cur["name"] = m_choice
                st.session_state.m_cur["max_hp"] = enemies[m_choice]["hp"]
                st.session_state.r_battle = True
                st.session_state.r_skill_cd = 0
                st.session_state.r_ult_cd = 0
                st.session_state.r_log.insert(0, f"[{m_choice}] 진영에 난입했습니다! 생존 투쟁이 시작됩니다.")
                st.rerun()
        else:
            m = st.session_state.m_cur
            st.error(f"👿 위협적인 적 **{m['name']}** 과 대치 중!")
            st.write(f"💥 **적 체력 정보:** {m['hp']} / {m['max_hp']}")
            st.progress(max(0.0, min(1.0, m["hp"] / m["max_hp"])))

            bc1, bc2, bc3, bc4 = st.columns(4)
            
            if bc1.button("🗡️ 기본공격", use_container_width=True):
                p_dmg = max(1, total_atk - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_log.insert(0, f"⚔️ 용사의 일반 일격! [{m['name']}]에게 {p_dmg}의 대미지!")
                enemy_turn_process(m, total_def)
                st.rerun()

            skill_label = "⚡ 전투스킬 [질풍 연격]"
            if not st.session_state.r_has_skill:
                skill_label += " (미해금)"
            elif st.session_state.r_skill_cd > 0:
                skill_label += f" ({st.session_state.r_skill_cd}턴 대기)"
            
            if bc2.button(skill_label, disabled=(not st.session_state.r_has_skill or st.session_state.r_skill_cd > 0), use_container_width=True):
                p_dmg = max(5, int(total_atk * 1.8) - m["def"])
                m["hp"] -= p_dmg
                st.session_state.r_skill_cd = 3
                st.session_state.r_log.insert(0, f"⚡ [전투스킬] 신속한 질풍 연격 폭사! [{m['name']}]에게 {p_dmg}의 파괴적 대미지!")
                enemy_turn_process(m, total_def)
                st.rerun()

            ult_label = "🔱 궁극기 [성운 붕괴 폭발]"
            if not st.session_state.r_has_ult:
                ult_label += " (미해금)"
            elif st.session_state.r_ult_cd > 0:
                ult_label += f" ({st.session_state.r_ult_cd}턴 대기)"
                
            if bc3.button(ult_label, disabled=(not st.session_state.r_has_ult or st.session_state.r_ult_cd > 0), use_container_width=True):
                p_dmg = int(total_atk * 3.2)
                m["hp"] -= p_dmg
                st.session_state.r_ult_cd = 5
                st.session_state.r_log.insert(0, f"🔱 [궁극기] 차원을 가르는 성운 붕괴 폭발 시전! 적 방어무시 {p_dmg}의 파멸적인 대미지 고정 타격!")
                enemy_turn_process(m, total_def)
                st.rerun()

            if bc4.button("🏃 후방 퇴각", use_container_width=True):
                st.session_state.r_battle = False
                st.session_state.r_log.insert(0, "💨 위기 상황을 감지하고 전장 작전구역에서 이탈했습니다.")
                st.rerun()

    # --- 2번 탭: 장비 및 무공 비급 상점 ---
    with tab2:
        st.subheader("⚔️ 무기고 대장간")
        st.write(f"현재 무기: **{st.session_state.r_w_name}** (+{st.session_state.r_w_atk}) | 현재 방어구: **{st.session_state.r_a_name}** (+{st.session_state.r_a_def})")
        st.divider()

        w_cols = st.columns(3)
        w_list = [
            {"name": "🪵 훈련용 장단 목검", "atk": 5, "price": 40},
            {"name": "⚔️ 정련된 강철 롱소드", "atk": 15, "price": 120},
            {"name": "✨ 마력 주입된 기사창", "atk": 35, "price": 320},
            {"name": "☄️ 천공의 성광 대검", "atk": 75, "price": 750},
            {"name": "🔥 드래곤 슬레이어 오리진", "atk": 160, "price": 1800}
        ]
        for idx, w in enumerate(w_list):
            with w_cols[idx % 3]:
                if st.button(f"{w['name']}\n(공격 +{w['atk']}) | 💰 {w['price']} G"):
                    if st.session_state.r_gold >= w['price']:
                        st.session_state.r_gold -= w['price']
                        st.session_state.r_w_name = w['name']
                        st.session_state.r_w_atk = w['atk']
                        st.session_state.r_log.insert(0, f"🛒 무기 [{w['name']}]을(를) 구매하여 주 무기로 커스텀 세팅했습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("군자금이 부족합니다.")

        st.divider()
        st.subheader("🛡️ 방어구 보급소")
        a_cols = st.columns(3)
        a_list = [
            {"name": "🧥 야전 가죽 장갑복", "def": 4, "price": 50},
            {"name": "⛓️ 겹강화 징 사슬갑옷", "def": 12, "price": 160},
            {"name": "🔱 성기사의 티타늄 판금 아머", "def": 30, "price": 600},
            {"name": "🌌 오로라 불멸의 성해 아머", "def": 70, "price": 1500}
        ]
        for idx, a in enumerate(a_list):
            with a_cols[idx % 3]:
                if st.button(f"{a['name']}\n(방어 +{a['def']}) | 💰 {a['price']} G"):
                    if st.session_state.r_gold >= a['price']:
                        st.session_state.r_gold -= a['price']
                        st.session_state.r_a_name = a['name']
                        st.session_state.r_a_def = a['def']
                        st.session_state.r_log.insert(0, f"🛒 신형 기갑 방어구 [{a['name']}]을(를) 인수했습니다.")
                        save_rpg()
                        st.rerun()
                    else: st.error("군자금이 부족합니다.")

        st.divider()
        st.subheader("📜 영웅 무공 비급 상점 (스킬 상점)")
        s_col1, s_col2 = st.columns(2)
        
        with s_col1:
            st.write("### ⚡ 전투스킬 [질풍 연격]")
            st.write("공격력의 **1.8배** 피해를 가합니다. (재사용 대기시간: 3턴)")
            if st.session_state.r_has_skill:
                st.success("✅ 비급 연마 완료 (사용 가능)")
            else:
                if st.button("📜 질풍 연격 비급서 구매 | 💰 250 G"):
                    if st.session_state.r_gold >= 250:
                        st.session_state.r_gold -= 250
                        st.session_state.r_has_skill = True
                        st.session_state.r_log.insert(0, "✨ 스킬 [질풍 연격]을 깨달았습니다!")
                        save_rpg()
                        st.rerun()
                    else: st.error("골드가 부족합니다.")

        with s_col2:
            st.write("### 🔱 궁극기 [성운 붕괴 폭발]")
            st.write("적 방어력을 **100% 무시**하고 공격력의 **3.2배** 고정 대미지를 날립니다. (재사용 대기시간: 5턴)")
            if st.session_state.r_has_ult:
                st.success("✅ 무공 마스터 완료 (사용 가능)")
            else:
                if st.button("📜 성운 붕괴 비급서 구매 | 💰 650 G"):
                    if st.session_state.r_gold >= 650:
                        st.session_state.r_gold -= 650
                        st.session_state.r_has_ult = True
                        st.session_state.r_log.insert(0, "✨ 궁극기 [성운 붕괴 폭발] 연마에 성공했습니다!")
                        save_rpg()
                        st.rerun()
                    else: st.error("골드가 부족합니다.")

        st.divider()
        if st.button("💖 엘릭서 특급 성수 복용 (체력 전면 회복) | 💰 25 G"):
            if st.session_state.r_gold >= 25:
                if st.session_state.r_hp == st.session_state.r_max_hp:
                    st.warning("신체 에너지가 최대 충전 상태입니다.")
                else:
                    st.session_state.r_gold -= 25
                    st.session_state.r_hp = st.session_state.r_max_hp
                    st.session_state.r_log.insert(0, "🧪 성수를 흡수하여 완벽히 회복되었습니다.")
                    save_rpg()
                    st.rerun()
            else: st.error("골드가 부족합니다.")

    # --- 3번 탭: 세이브 시스템 연동부 ---
    with tab3:
        st.write("### 💾 영웅 데이터베이스 파일 입출력")
        sm1, sm2 = st.columns(2)
        if sm1.button("💾 동기화 데이터 쓰기 (Save)"):
            save_rpg()
            st.success("보유 스킬정보를 포함하여 파일에 저장되었습니다.")
        if sm2.button("📂 동기화 데이터 읽기 (Load)"):
            if load_rpg():
                st.success("성공적으로 세이브 스탯 및 스킬 정보를 불러왔습니다!")
                st.rerun()
            else: st.error("연결 가능한 세이브 파일이 로컬 디렉토리에 없습니다.")

    st.divider()
    st.write("### 📜 배틀 로깅 시스템 기록창")
    for log in st.session_state.r_log[:5]:
        st.write(log)
# ==========================================
# 7. 메인 네비게이션 진입 게이트웨이
# ==========================================
st.set_page_config(
    page_title="종합 게임 허브 스트림릿",
    page_icon="🌟",
    layout="wide"
)

home = st.Page(home_page, title="홈 화면", icon="🌟")
game = st.Page(game_page, title="업다운 게임", icon="🎮")
board = st.Page(board_page, title="뱀사다리 말판 게임", icon="🎲")
quoridor = st.Page(quoridor_page, title="쿼리도 두뇌 게임", icon="🧱")
rpg = st.Page(rpg_page, title="성장형 RPG 게임", icon="⚔️")

pg = st.navigation([home, game, board, quoridor, rpg])
pg.run()
